import { describe, expect, test } from 'bun:test'

import { getVideoId } from './youtube'

describe('getVideoId', () => {
    test.each([
        ['https://youtu.be/dQw4w9WgXcQ?si=abc', 'dQw4w9WgXcQ'],
        ['https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42', 'dQw4w9WgXcQ'],
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
