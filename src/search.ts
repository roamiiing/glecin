import { promisify } from 'util'
import { exec, execFile } from 'child_process'
import { readFile } from 'fs/promises'

import { tmpdir } from 'os'
import path from 'path'
import { existsSync } from 'fs'

const execAsync = promisify(exec)
const execFileAsync = promisify(execFile)

const YOUTUBE_SEARCH_RESULT_COUNT = 10
const YOUTUBE_PLAYLIST_LIMIT = 20
const YOUTUBE_VIDEO_ID_PATTERN = /^[a-zA-Z0-9_-]{11}$/

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

export type YoutubePlaylist = {
    playlistId: string
    title: string
    videos: YoutubeVideo[]
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

type YtDlpPlaylistEntry = YtDlpSearchEntry & {
    playlist?: unknown
}

type ExecFileError = Error & {
    stdout?: unknown
}

function getStdoutFromExecFileError(error: unknown): string | null {
    if (!error || typeof error !== 'object' || !('stdout' in error)) {
        return null
    }

    const stdout = (error as ExecFileError).stdout
    return typeof stdout === 'string' && stdout.trim() ? stdout : null
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

function mapYtDlpPlaylistEntry(entry: YtDlpPlaylistEntry): YoutubeVideo | null {
    if (typeof entry.id !== 'string' || !YOUTUBE_VIDEO_ID_PATTERN.test(entry.id) || typeof entry.title !== 'string') {
        return null
    }

    if (typeof entry.duration !== 'number' || Number.isNaN(entry.duration) || entry.duration <= 0) {
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

export async function getYoutubePlaylistVideos(playlistId: string, limit = YOUTUBE_PLAYLIST_LIMIT): Promise<YoutubePlaylist | null> {
    playlistId = playlistId.trim()

    const url = new URL('https://www.youtube.com/playlist')
    url.searchParams.set('list', playlistId)

    let stdout: string
    try {
        const result = await execFileAsync(
            'yt-dlp',
            ['--dump-json', '--playlist-end', limit.toString(), '--ignore-errors', '--skip-download', url.toString()],
            {
                maxBuffer: 50 * 1024 * 1024,
            },
        )
        stdout = result.stdout
    } catch (error) {
        const partialStdout = getStdoutFromExecFileError(error)
        if (!partialStdout) {
            console.error(error)
            return null
        }

        console.warn('yt-dlp playlist command failed, using partial stdout')
        stdout = partialStdout
    }

    const entries = stdout
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .flatMap((line): YtDlpPlaylistEntry[] => {
            try {
                const parsed = JSON.parse(line) as unknown
                if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
                    return []
                }

                return [parsed as YtDlpPlaylistEntry]
            } catch (error) {
                console.error(error)
                return []
            }
        })

    const videos = entries.map(mapYtDlpPlaylistEntry).filter((video) => video !== null)
    if (videos.length === 0) {
        return null
    }

    const title = entries.find((entry) => typeof entry.playlist === 'string')?.playlist

    return {
        playlistId,
        title: typeof title === 'string' ? title : playlistId,
        videos,
    }
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
