import axios from 'axios'
import { Browser } from 'happy-dom'
import { promisify } from 'util'
import { exec } from 'child_process'
import { readFile } from 'fs/promises'

import { createFakeHeaders } from './fake-headers'
import { tmpdir } from 'os'
import path from 'path'
import { existsSync } from 'fs'

const execAsync = promisify(exec)

const YOUTUBE_HEADERS = {
    ...createFakeHeaders({
        origin: 'https://www.youtube.com',
        referer: 'https://www.youtube.com/',
        host: 'www.youtube.com',
    }),

    'X-YouTube-Client-Name': '1',
    'X-YouTube-Client-Version': '2.20211110.00.00',
    'Content-Type': 'text/html; charset=utf-8',
}

function isValidVideoTitle(videoName: string, query: string): boolean {
    return ['cover', 'remix', 'playlist', 'double', 'dual'].every(
        (keyword) =>
            !(
                (videoName.toLowerCase().includes(keyword) && !query.toLowerCase().includes(keyword)) ||
                (!videoName.toLowerCase().includes(keyword) && query.toLowerCase().includes(keyword))
            ),
    )
}

export type YoutubeVideo = {
    videoId: string
    title: string
    duration: number
    viewCount: number
}

export async function searchYoutube(searchTerm: string): Promise<YoutubeVideo | null> {
    console.log('Search term', searchTerm)

    const url = new URL('https://youtube.com/results')
    url.searchParams.set('search_query', searchTerm)

    const { data: text } = await axios.get(url.toString(), {
        headers: YOUTUBE_HEADERS,
    })

    const browser = new Browser()
    const page = browser.newPage()

    page.content = text
    const doc = page.mainFrame.document

    if (!doc) {
        throw new Error('Failed to parse HTML')
    }

    const scripts = Array.from(page.mainFrame.window.document.querySelectorAll('script'))

    const ytInitialDataScript = scripts.find((script) => script.textContent?.includes('ytInitialData'))

    if (!ytInitialDataScript) {
        throw new Error('Failed to find ytInitialData script')
    }

    const ytInitialData = ytInitialDataScript.textContent?.match(/ytInitialData\s*=\s*(.*);/)?.[1]

    if (!ytInitialData) {
        throw new Error('Failed to find ytInitialData')
    }

    const ytInitialDataJson = JSON.parse(ytInitialData)

    const videos = ytInitialDataJson.contents.twoColumnSearchResultsRenderer.primaryContents.sectionListRenderer.contents[0].itemSectionRenderer.contents
        .map((content: any) => {
            const videoRenderer = content.videoRenderer

            if (!videoRenderer) {
                return null
            }

            if (videoRenderer.navigationEndpoint?.commandMetadata?.webCommandMetadata?.url?.includes('shorts')) {
                return null
            }

            const videoId = videoRenderer.videoId as string
            const title = videoRenderer.title.runs[0].text as string
            const duration =
                (videoRenderer.lengthText?.simpleText as string)?.split(':').reduce((acc, v, i, a) => {
                    return acc + parseInt(v) * Math.pow(60, a.length - i - 1)
                }, 0) * 1000 // 0:30 / 2:55 / 1:45:33

            const viewCount = parseInt((videoRenderer.viewCountText?.simpleText as string)?.match(/((\d\s*)+)/)?.[0]?.replaceAll(/\s/g, '') ?? '0')

            if (Number.isNaN(duration)) {
                return null
            }

            if (!isValidVideoTitle(title, searchTerm)) {
                return null
            }

            return {
                videoId,
                title,
                duration,
                viewCount,
            }
        })
        .filter(Boolean) as YoutubeVideo[]

    const video = videos.at(0)

    if (!video) {
        return null
    }

    return video
}

export async function getYoutubeVideo(videoId: string): Promise<YoutubeVideo | null> {
    videoId = videoId.trim()

    const url = new URL('https://www.youtube.com/watch')
    url.searchParams.set('v', videoId)

    const tmpDirPath = tmpdir()

    try {
        await execAsync(`yt-dlp ${url.toString()} --write-info-json --skip-download -o "%(id)s.%(ext)s"`, {
            cwd: tmpDirPath,
        })
    } catch (error) {
        console.error(error)
        return null
    }

    const infoJsonPath = path.join(tmpDirPath, `${videoId}.info.json`)

    if (!existsSync(infoJsonPath)) {
        return null
    }

    let jsonText
    try {
        jsonText = await readFile(infoJsonPath, 'utf-8')
    } catch (error) {
        console.error(error)
        return null
    }

    let json
    try {
        json = JSON.parse(jsonText)
    } catch (error) {
        console.error(error)
        return null
    }

    if (!json || !json['title'] || !json['duration']) {
        return null
    }

    return {
        videoId,
        title: json['title'],
        duration: json['duration'] * 1000,
        viewCount: json['view_count'],
    }
}
