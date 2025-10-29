import { sendTCPMessage } from './tcp'

export type AtsRequest = {
    data: string
    pkg?: string
}

export async function sendToTv(tvIp: string, request: AtsRequest) {
    return await sendTCPMessage(tvIp, 8888, JSON.stringify(request))
}
