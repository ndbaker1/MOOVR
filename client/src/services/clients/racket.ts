import { createServerWebSocket } from "../connection"
import { AxisUpdate } from "../data";
import { startAccelerometer, startOrientationTracker } from "../sensors";

export class RacketClient {
  public ws: WebSocket

  constructor(id: number) {
    this.ws = createServerWebSocket(`/racket/${id}`)

    const send = (data: AxisUpdate) => { this.ws.send(data.intoJson()) }

    startAccelerometer(send)
    // startOrientationTracker(send)
  }
}