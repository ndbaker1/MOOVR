import { createServerWebSocket } from "../connection";
import { PlayerData } from "../data";

export class ObserverClient {
    public ws: WebSocket

    constructor(id: number) {
        this.ws = createServerWebSocket(`/observer/${id}`)
    }

    public static asPlayerData(data: unknown): PlayerData[] {
        if (typeof data === 'string') {
            return JSON.parse(data)
        }
        throw Error('invalid data')
    }
}
