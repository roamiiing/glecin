import type { Api, Middleware } from 'grammy'
import { getHelpString } from './help'

const AUTHORIZED_CHATS: Set<number> = new Set()

export function getAuthLink(chatId: number) {
    const authBaseUrl = Bun.env.AUTH_BASE_URL
    if (!authBaseUrl) {
        throw new Error('AUTH_BASE_URL is required')
    }

    const url = new URL(authBaseUrl)
    url.searchParams.set('chatId', chatId.toString())
    return url.toString()
}

export function isAuthorized(chatId: number) {
    return AUTHORIZED_CHATS.has(chatId)
}

function authorize(chatId: number) {
    AUTHORIZED_CHATS.add(chatId)
}

export const authMiddleware: Middleware = async (ctx, next) => {
    if (!ctx.chat?.id) {
        return
    }

    if (!isAuthorized(ctx.chat.id)) {
        return await ctx.api.sendMessage(ctx.chat.id, 'Ты не авторизован\n\n' + getHelpString(ctx.chat.id), { parse_mode: 'HTML' })
    }

    await next()
}

export function listenAuthServer(api: Api) {
    Bun.serve({
        hostname: '0.0.0.0',
        port: 3339,
        routes: {
            '/': (req) => {
                const url = new URL(req.url)
                const chatIdString = url.searchParams.get('chatId')

                if (!chatIdString) {
                    return new Response('chatId not found', { status: 400 })
                }

                const chatId = Number(chatIdString)

                if (!chatId) {
                    return new Response('chatId is not a number', { status: 400 })
                }

                authorize(chatId)

                api.sendMessage(chatId, 'Вы успешно авторизованы!\n\n' + getHelpString(chatId), { parse_mode: 'HTML' })

                return new Response('<html><script>window.close()</script></html>', {
                    status: 200,
                    headers: {
                        'Content-Type': 'text/html',
                    },
                })
            },
        },
        fetch(_req) {
            return new Response('not found', { status: 404 })
        },
    })
}
