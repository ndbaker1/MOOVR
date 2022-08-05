import { createServerWebSocket } from "../connection";

export class ObserverClient {
    public ws: WebSocket

    constructor(id: number) {
        this.ws = createServerWebSocket(`/observer/${id}`)
    }
}
