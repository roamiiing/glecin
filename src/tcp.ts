import net from 'net'

export function sendTCPMessage(host: string, port: number, message: string) {
    return new Promise((resolve, reject) => {
        const client = new net.Socket()

        client.connect(port, host, () => {
            client.write(message, () => {
                client.end()
            })
        })

        client.on('data', () => {
            resolve(null)
            client.destroy()
        })

        client.on('error', reject)

        client.on('close', () => {
            reject(new Error('Connection closed'))
        })

        client.on('end', () => {
            resolve(null)
            client.destroy()
        })
    })
}
