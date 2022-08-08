import { createServerWebSocket } from "../connection"
import { ChangeData } from "../data";
import { startAccelerometer, startOrientationTracker } from "../sensors";

export class RacketClient {
  public ws: WebSocket

  constructor(id: number) {
    this.ws = createServerWebSocket(`/racket/${id}`)

    const send = (data: ChangeData) => {
      this.ws.send(JSON.stringify(data))
    }

    startAccelerometer(send)
    startOrientationTracker(send)
  }
}