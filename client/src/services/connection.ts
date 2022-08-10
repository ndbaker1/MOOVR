
export type WebSocketConfig = {
    path: string,
    host: string,
} & WebSocketCallbacks

export type WebSocketCallbacks = {
    closeCallback?: (_: CloseEvent) => any,
    errorCallback?: (_: Event) => any,
    openCallback?: (_: Event) => any,
}

export function createServerWebSocket({ path, host, closeCallback, errorCallback, openCallback }: WebSocketConfig) {

    const protocol = location.protocol.includes('https') ? 'wss' : 'ws';

    const webSocketUrl = `${protocol}://${host}${path}`;

    if (!webSocketUrl.startsWith('ws')) {
        throw Error('bad url');
    }

    const ws = new WebSocket(webSocketUrl);

    ws.addEventListener('close', e => closeCallback ? closeCallback(e) : console.log(JSON.stringify(e)));
    ws.addEventListener('error', e => errorCallback ? errorCallback(e) : console.error(JSON.stringify(e)));
    ws.addEventListener('open', e => openCallback ? openCallback(e) : console.log(JSON.stringify(e)));

    return ws;
}

