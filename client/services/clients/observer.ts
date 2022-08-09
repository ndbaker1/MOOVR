import { createServerWebSocket, WebSocketCallbacks } from "../connection";
import { PlayerData } from "../data";

export class ObserverClient {
    public ws: WebSocket

    constructor(public id: number, host: string, callbacks: WebSocketCallbacks) {
        this.ws = createServerWebSocket({ host, path: `/observer/${id}`, ...callbacks })
    }

    public static asPlayerData(data: unknown): Record<number, PlayerData> {
        if (typeof data === 'string') {
            return JSON.parse(data)
        }
        throw Error('invalid data')
    }
}
