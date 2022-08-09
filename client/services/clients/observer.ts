import { createServerWebSocket } from "../connection";
import { PlayerData } from "../data";

export class ObserverClient {
    public ws: WebSocket

    constructor(id: number, host: string) {
        this.ws = createServerWebSocket({ host, path: `/observer/${id}` })
    }

    public static asPlayerData(data: unknown): Record<number, PlayerData> {
        if (typeof data === 'string') {
            return JSON.parse(data)
        }
        throw Error('invalid data')
    }
}
