import { Bot, Composer, InputFile, type Middleware } from 'grammy'
import { getYoutubePlaylistVideos, getYoutubeVideo, searchYoutube } from './search'
import { escapeAll } from './escape'
import { Queue } from './queue'
import { sendToTv } from './atsApi'
import { getPlaylistId, getVideoId } from './youtube'
import { authMiddleware, listenAuthServer } from './auth'
import { getHelpString } from './help'
import { qrCodeBytes } from './qr'

const token = Bun.env.TOKEN
const tvIp = Bun.env.TV_IP

if (!token) {
    throw new Error('TOKEN is required')
}

if (!tvIp) {
    throw new Error('TV_IP is required')
}

const bot = new Bot(token)

const queue = new Queue()

listenAuthServer(bot.api)

queue.registerEvaluation(async (item) => {
    await sendToTv(tvIp, {
        data: 'https://youtu.be/' + item.video.videoId,
        pkg: 'org.smarttube.stable',
    })
})

queue.registerError(async (item, error) => {
    console.error(error, item)
    await bot.api.sendMessage(item.user.telegramChatId, `Произошла ошибка при попытке воспроивести видео: ${escapeAll(error.toString())}`, {
        parse_mode: 'HTML',
    })
})

const protectedCommands = new Composer()

protectedCommands.use(authMiddleware)

type MessageWithUrls = {
    text?: string
    entities?: Array<{
        type: string
        offset: number
        length: number
        url?: string
    }>
}

function getMessageUrls(message?: MessageWithUrls): string[] {
    if (!message?.text || !message.entities) {
        return []
    }

    const text = message.text

    return message.entities.flatMap((entity) => {
        if (entity.type === 'text_link' && entity.url) {
            return [entity.url]
        }

        if (entity.type === 'url') {
            return [text.slice(entity.offset, entity.offset + entity.length)]
        }

        return []
    })
}

const play: Middleware = async (ctx) => {
    if (!ctx.chat?.id) {
        return
    }

    const fullMessage = ctx.message?.text

    let query = fullMessage
    if (fullMessage?.startsWith('/')) {
        query = fullMessage?.split(' ').slice(1).join(' ')
    }

    if (!query) {
        return await ctx.reply('Напиши название видео или ссылку, например: <code>/play сигма бой</code>', { parse_mode: 'HTML' })
    }

    const lookupText = [query, ...getMessageUrls(ctx.message)].join(' ')
    const videoId = getVideoId(lookupText)
    const playlistId = videoId ? null : getPlaylistId(lookupText)
    const statusText = videoId
        ? `<code>[👀]</code> Получаю метаданные видео: ${escapeAll(query)}`
        : playlistId
          ? `<code>[👀]</code> Получаю метаданные плейлиста: ${escapeAll(query)}`
          : `<code>[👀]</code> Уже ищу: ${escapeAll(query)}`
    const repliedMessage = await ctx.reply(statusText, { parse_mode: 'HTML' })

    const user = {
        telegramChatId: ctx.chat.id,
        nickname: ctx.from?.username ?? ctx.from?.first_name ?? 'Мефедроновая шлюха',
    }

    let video
    try {
        if (videoId) {
            video = await getYoutubeVideo(videoId)
        } else {
            if (playlistId) {
                const playlist = await getYoutubePlaylistVideos(playlistId)
                if (!playlist) {
                    return await ctx.api.editMessageText(
                        ctx.chat.id,
                        repliedMessage.message_id,
                        '<code>[🙂‍↔️]</code> Не удалось прочитать плейлист или в нем нет доступных видео',
                        { parse_mode: 'HTML' },
                    )
                }

                for (const playlistVideo of playlist.videos) {
                    queue.add(playlistVideo, user)
                }

                const firstVideo = playlist.videos[0]
                if (!firstVideo) {
                    return await ctx.api.editMessageText(
                        ctx.chat.id,
                        repliedMessage.message_id,
                        '<code>[🙂‍↔️]</code> Не удалось прочитать плейлист или в нем нет доступных видео',
                        { parse_mode: 'HTML' },
                    )
                }

                return await ctx.api.editMessageText(
                    ctx.chat.id,
                    repliedMessage.message_id,
                    `<code>[✅]</code> Добавил плейлист: ${escapeAll(playlist.title || playlist.playlistId)}
Видео: ${playlist.videos.length} из 20
Первое: https://youtu.be/${firstVideo.videoId}
${escapeAll(firstVideo.title)}`,
                    { parse_mode: 'HTML' },
                )
            } else {
                video = await searchYoutube(query)
            }
        }
    } catch (error: unknown) {
        await ctx.api.editMessageText(
            ctx.chat.id,
            repliedMessage.message_id,
            `<code>[❌]</code> Произошла ошибка: ${escapeAll(error instanceof Error ? error.toString() : 'Неизвестная ошибка')}`,
            { parse_mode: 'HTML' },
        )
        console.error(error)
    }

    if (!video) {
        return await ctx.api.editMessageText(ctx.chat.id, repliedMessage.message_id, '<code>[🙂‍↔️]</code>Таких видео нет =(', { parse_mode: 'HTML' })
    }

    queue.add(video, {
        telegramChatId: user.telegramChatId,
        nickname: user.nickname,
    })

    await ctx.api.editMessageText(
        ctx.chat.id,
        repliedMessage.message_id,
        `<code>[✅]</code>Добавил в очередь это:\nhttps://youtu.be/${video.videoId}\n${escapeAll(video.title)}`,
        { parse_mode: 'HTML' },
    )
}

protectedCommands.command(['play', 'p'], play)

protectedCommands.command(['queue', 'que', 'qu', 'q'], async (ctx) => {
    const current = queue.getCurrent()

    if (!current) {
        return await ctx.reply('<code>[❌]</code> Очередь пуста', { parse_mode: 'HTML' })
    }

    let queueText = `<code>[👀]</code> Текущее видео: <a href="https://youtu.be/${current.video.videoId}">${escapeAll(current.video.title)}</a> (by ${escapeAll(current.user.nickname)})\n\n<code>[➡️]</code>Далее:\n\n`

    if (queue.size() === 1) {
        queueText += '<i>Ничего</i>'
    }

    for (const item of queue.getAll().slice(1)) {
        queueText += `<a href="https://youtu.be/${item.video.videoId}">${escapeAll(item.video.title)}</a> (by ${escapeAll(item.user.nickname)})\n`
    }

    await ctx.reply(queueText, { parse_mode: 'HTML' })
})

protectedCommands.command(['skip', 's'], async (ctx) => {
    const removed = queue.remove()

    if (!removed) {
        return await ctx.reply('<code>[❌]</code> Очередь пуста', { parse_mode: 'HTML' })
    }

    const current = queue.getCurrent()

    if (!current) {
        return await ctx.reply(`<code>[❌]</code> Пропустил трек ${escapeAll(removed.video.title)}. Дальше тишина.`, { parse_mode: 'HTML' })
    }

    await ctx.reply(`<code>[✅]</code> Пропустил ${escapeAll(removed.video.title)}. Дальше: ${escapeAll(current.video.title)}`, {
        parse_mode: 'HTML',
    })
})

protectedCommands.command(['pop'], async (ctx) => {
    const removed = queue.pop()

    if (!removed) {
        return await ctx.reply('<code>[❌]</code> Очередь пуста', { parse_mode: 'HTML' })
    }

    await ctx.reply(`<code>[✅]</code> Убрал из очереди ${escapeAll(removed.video.title)}.`, {
        parse_mode: 'HTML',
    })
})

protectedCommands.command(['clear', 'c'], async (ctx) => {
    queue.clear()
    await ctx.reply('<code>[✅]</code> Очередь очищена', { parse_mode: 'HTML' })
})

protectedCommands.on('message:text', async (ctx, next) => {
    if (ctx.chat.type !== 'private' || ctx.message.text.startsWith('/')) {
        return await next()
    }

    await play(ctx, next)
})

bot.command(['start', 'help'], async (ctx) => {
    if (!ctx.chat.id) {
        return
    }

    await ctx.replyWithPhoto(new InputFile(qrCodeBytes), {
        parse_mode: 'HTML',
        caption: getHelpString(ctx.chat.id),
    })
})

bot.use(protectedCommands)

bot.start()
