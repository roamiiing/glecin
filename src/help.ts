import { escapeAll } from './escape'
import { getAuthLink, isAuthorized } from './auth'

const COMMANDS: { command: string; description: string; example?: string }[] = [
    { command: 'play', description: 'Воспроизвести видео. Можно отправить ссылку на YouTube, либо поисковый запрос обычным сообщением', example: 'dj арбуз' },
    { command: 'skip', description: 'Пропустить текущее видео' },
    { command: 'pop', description: 'Убрать из очереди последнее добавленное видео' },
    { command: 'queue', description: 'Показать очередь' },
    { command: 'clear', description: 'Очистить очередь' },
]

export function getHelpString(chatId: number) {
    const isUserAuthorized = isAuthorized(chatId)

    const helpText = COMMANDS.map(
        (command) =>
            `/${escapeAll(command.command)} - ${escapeAll(command.description)}${command.example ? ` (например: <code>${escapeAll(command.example)}</code>)` : ''}`,
    ).join('\n')

    return !isUserAuthorized
        ? 'Если тебе нужен Wi-Fi, то вот креды от него:\n\nSSID: <code>/r</code>\nPASS: <code>domizalmazov</code>\n\n' +
              `Как подключишься к Wi-Fi, <a href="${getAuthLink(chatId)}">авторизуйся в локальной сети по этой ссылке</a>.`
        : 'Команды:\n' + helpText
}
