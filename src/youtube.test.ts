import { describe, expect, test } from 'bun:test'

import { getPlaylistId, getVideoId } from './youtube'

describe('getVideoId', () => {
    test.each([
        ['https://youtu.be/dQw4w9WgXcQ?si=abc', 'dQw4w9WgXcQ'],
        ['https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42', 'dQw4w9WgXcQ'],
        ['https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLynG8gQD-n8Byyq30_FOq9ylUFL1nTkGC', 'dQw4w9WgXcQ'],
        ['https://youtube.com/shorts/dQw4w9WgXcQ?si=abc', 'dQw4w9WgXcQ'],
        ['https://m.youtube.com/live/dQw4w9WgXcQ?feature=share', 'dQw4w9WgXcQ'],
        ['www.youtube.com/embed/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
        ['watch this https://youtu.be/dQw4w9WgXcQ.', 'dQw4w9WgXcQ'],
        ['dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ])('extracts video id from %s', (input, expected) => {
        expect(getVideoId(input)).toBe(expected)
    })

    test('returns null for a text query', () => {
        expect(getVideoId('сигма бой')).toBeNull()
    })
})

describe('getPlaylistId', () => {
    test.each([
        ['https://www.youtube.com/playlist?list=PLynG8gQD-n8Byyq30_FOq9ylUFL1nTkGC', 'PLynG8gQD-n8Byyq30_FOq9ylUFL1nTkGC'],
        ['https://music.youtube.com/playlist?list=OLAK5uy_mAQ', 'OLAK5uy_mAQ'],
        ['listen to https://www.youtube.com/playlist?list=PLynG8gQD-n8Byyq30_FOq9ylUFL1nTkGC.', 'PLynG8gQD-n8Byyq30_FOq9ylUFL1nTkGC'],
    ])('extracts playlist id from %s', (input, expected) => {
        expect(getPlaylistId(input)).toBe(expected)
    })

    test.each([
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLynG8gQD-n8Byyq30_FOq9ylUFL1nTkGC',
        'сигма бой',
    ])('returns null for %s', (input) => {
        expect(getPlaylistId(input)).toBeNull()
    })
})
