export function createServerWebSocket(path: string) {

    const protocol = location.protocol.includes('https') ? 'wss' : 'ws'
    const origin = 'localhost:42069'

    const webSocketUrl = `${protocol}://${origin}${path}`

    if (!webSocketUrl.startsWith('ws')) {
        throw Error('bad url')
    }

    const ws = new WebSocket(webSocketUrl)

    ws.addEventListener('close', e => alert(e))
    ws.addEventListener('error', e => alert(e))
    ws.addEventListener('open', e => alert(e))

    return ws
}

