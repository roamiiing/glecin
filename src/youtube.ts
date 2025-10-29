const VIDEO_ID_PATTERN = /^[a-zA-Z0-9_-]{11}$/
const YOUTUBE_HOST_PATTERN = /^(?:www\.|m\.|music\.)?(?:youtube\.com|youtube-nocookie\.com)$/
const YOUTUBE_URL_PATTERN = /(?:https?:\/\/)?(?:www\.|m\.|music\.)?(?:youtube\.com|youtube-nocookie\.com|youtu\.be)\/[^\s<>"']+/gi

function normalizeUrlCandidate(value: string): string {
    return value.trim().replace(/[),.]+$/g, '')
}

function getVideoIdFromUrl(value: string): string | null {
    const normalizedValue = normalizeUrlCandidate(value)
    const urlValue = normalizedValue.startsWith('http://') || normalizedValue.startsWith('https://') ? normalizedValue : `https://${normalizedValue}`

    let url
    try {
        url = new URL(urlValue)
    } catch {
        return null
    }

    const hostname = url.hostname.toLowerCase()

    if (hostname === 'youtu.be') {
        const videoId = url.pathname.split('/').filter(Boolean).at(0)
        return videoId && VIDEO_ID_PATTERN.test(videoId) ? videoId : null
    }

    if (!YOUTUBE_HOST_PATTERN.test(hostname)) {
        return null
    }

    const watchVideoId = url.searchParams.get('v')
    if (watchVideoId && VIDEO_ID_PATTERN.test(watchVideoId)) {
        return watchVideoId
    }

    const pathParts = url.pathname.split('/').filter(Boolean)
    const knownVideoPathIndex = pathParts.findIndex((part) => ['shorts', 'live', 'embed', 'v', 'e'].includes(part))
    const pathVideoId = knownVideoPathIndex >= 0 ? pathParts.at(knownVideoPathIndex + 1) : null

    return pathVideoId && VIDEO_ID_PATTERN.test(pathVideoId) ? pathVideoId : null
}

export function getVideoId(input: string): string | null {
    const trimmedInput = input.trim()
    if (VIDEO_ID_PATTERN.test(trimmedInput)) {
        return trimmedInput
    }

    for (const match of trimmedInput.matchAll(YOUTUBE_URL_PATTERN)) {
        const videoId = getVideoIdFromUrl(match[0])
        if (videoId) {
            return videoId
        }
    }

    return null
}
