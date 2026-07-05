import { promisify } from 'util'
import { exec, execFile } from 'child_process'
import { readFile } from 'fs/promises'

import { tmpdir } from 'os'
import path from 'path'
import { existsSync } from 'fs'

const execAsync = promisify(exec)
const execFileAsync = promisify(execFile)

const YOUTUBE_SEARCH_RESULT_COUNT = 10

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

type YtDlpSearchEntry = {
    id?: unknown
    url?: unknown
    webpage_url?: unknown
    title?: unknown
    duration?: unknown
    view_count?: unknown
}

type YtDlpSearchResult = {
    entries?: unknown
}

function mapYtDlpSearchEntry(entry: YtDlpSearchEntry, searchTerm: string): YoutubeVideo | null {
    if (typeof entry.id !== 'string' || typeof entry.title !== 'string') {
        return null
    }

    const url = typeof entry.url === 'string' ? entry.url : ''
    const webpageUrl = typeof entry.webpage_url === 'string' ? entry.webpage_url : ''
    if (url.includes('/shorts/') || webpageUrl.includes('/shorts/')) {
        return null
    }

    if (typeof entry.duration !== 'number' || Number.isNaN(entry.duration)) {
        return null
    }

    if (!isValidVideoTitle(entry.title, searchTerm)) {
        return null
    }

    return {
        videoId: entry.id,
        title: entry.title,
        duration: entry.duration * 1000,
        viewCount: typeof entry.view_count === 'number' ? entry.view_count : 0,
    }
}

export async function searchYoutube(searchTerm: string): Promise<YoutubeVideo | null> {
    console.log('Search term', searchTerm)

    const { stdout } = await execFileAsync(
        'yt-dlp',
        [
            '--dump-single-json',
            '--flat-playlist',
            '--playlist-end',
            YOUTUBE_SEARCH_RESULT_COUNT.toString(),
            `ytsearch${YOUTUBE_SEARCH_RESULT_COUNT}:${searchTerm}`,
        ],
        {
            maxBuffer: 10 * 1024 * 1024,
        },
    )

    const result = JSON.parse(stdout) as YtDlpSearchResult
    if (!Array.isArray(result.entries)) {
        return null
    }

    return result.entries.map((entry) => mapYtDlpSearchEntry(entry as YtDlpSearchEntry, searchTerm)).find((video) => video !== null) ?? null
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
