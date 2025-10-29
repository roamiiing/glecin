import type { YoutubeVideo } from './search'

export type UserInfo = {
    telegramChatId: number
    nickname: string
}

export type QueueItem = {
    video: YoutubeVideo
    user: UserInfo
}

export class Queue {
    private timeoutId: NodeJS.Timeout | null = null
    private queue: QueueItem[] = []

    private evaluation: (item: QueueItem) => Promise<void> = () => Promise.resolve()
    private onError: (item: QueueItem, error: Error) => void = () => {}

    registerEvaluation(evaluation: (item: QueueItem) => Promise<void>) {
        this.evaluation = evaluation
    }

    registerError(onError: (item: QueueItem, error: Error) => void) {
        this.onError = onError
    }

    add(video: YoutubeVideo, user: UserInfo) {
        this.queue.push({ video, user })

        if (this.queue.length === 1) {
            if (this.timeoutId) {
                clearTimeout(this.timeoutId)
                this.timeoutId = null
            }
            this.evaluate()
        }
    }

    getCurrent() {
        return this.queue.at(0) ?? null
    }

    getAll() {
        return [...this.queue]
    }

    clear() {
        this.queue = []
    }

    remove(index?: number): QueueItem | null {
        let itemToReturn = null

        if (index === undefined) {
            itemToReturn = this.queue.shift() ?? null
        } else {
            itemToReturn = this.queue.splice(index, 1).at(0) ?? null
        }

        if (this.timeoutId) {
            clearTimeout(this.timeoutId)
            this.timeoutId = null
        }

        this.evaluate()

        return itemToReturn
    }

    pop(): QueueItem | null {
        return this.queue.pop() ?? null
    }

    size() {
        return this.queue.length
    }

    private evaluate() {
        const currentItem = this.queue.at(0)

        if (!currentItem) {
            return
        }

        this.evaluation(currentItem)
            .catch((error) => {
                this.remove()

                this.onError(currentItem, error)
            })
            .finally(() => {
                this.timeoutId = setTimeout(() => {
                    this.remove()
                }, currentItem.video.duration + 9_000)
            })
    }
}
