export function createServerWebSocket(path: string) {

    const webSocketUrl = `${location.protocol.includes('https') ? 'wss' : 'ws'}://sansan.loca.lt${path}`;

    if (!webSocketUrl.startsWith('ws')) {
        throw Error('bad url')
    }

    const ws = new WebSocket(webSocketUrl)

    ws.addEventListener('close', e => alert(e))
    ws.addEventListener('error', e => alert(e))
    ws.addEventListener('open', e => alert(e))

    return ws
}

