import { createServerWebSocket } from "../connection"
import { ChangeData } from "../data";
import { startAccelerometer, startOrientationTracker } from "../sensors";

export class RacketClient {
  public ws: WebSocket

  constructor(id: number, host: string) {
    this.ws = createServerWebSocket({ host, path: `/racket/${id}` })

    const send = (data: ChangeData) => {
      if (this.ws.readyState === this.ws.CLOSING || this.ws.readyState === this.ws.CLOSED) {
        throw Error('connection closed')
      }

      if (this.ws.readyState === this.ws.OPEN) {
        this.ws.send(JSON.stringify(data))
      }
    }

    startAccelerometer(send)
    startOrientationTracker(send)
  }
}