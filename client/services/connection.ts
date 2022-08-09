
export type WebSocketConfig = {
    path: string,
    host: string,
}

export function createServerWebSocket({ path, host }: WebSocketConfig) {

    const protocol = location.protocol.includes('https') ? 'wss' : 'ws'

    const webSocketUrl = `${protocol}://${host}${path}`

    if (!webSocketUrl.startsWith('ws')) {
        throw Error('bad url')
    }

    const ws = new WebSocket(webSocketUrl)

    ws.addEventListener('close', e => console.log(JSON.stringify(e)))
    ws.addEventListener('error', e => console.error(JSON.stringify(e)))
    ws.addEventListener('open', e => console.log(JSON.stringify(e)))

    return ws
}

