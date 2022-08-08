import { WS_ORIGIN } from "../environment"


export function createServerWebSocket(path: string) {

    const protocol = location.protocol.includes('https') ? 'wss' : 'ws'
    // allow us to override the websocker endpoint if we need
    const origin = sessionStorage.getItem('WS_ORIGIN') ?? WS_ORIGIN

    const webSocketUrl = `${protocol}://${origin}${path}`

    if (!webSocketUrl.startsWith('ws')) {
        throw Error('bad url')
    }

    const ws = new WebSocket(webSocketUrl)

    ws.addEventListener('close', e => console.log(JSON.stringify(e)))
    ws.addEventListener('error', e => console.error(JSON.stringify(e)))
    ws.addEventListener('open', e => console.log(JSON.stringify(e)))

    return ws
}

