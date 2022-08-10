import { createServerWebSocket, type WebSocketCallbacks } from "../connection";
import { startAccelerometer, startOrientationTracker } from "../sensors";
import type { ChangeData } from "../data";

export class RacketClient {
  public ws: WebSocket;

  constructor(public id: number, host: string, callbacks: WebSocketCallbacks) {
    if (!('LinearAccelerationSensor' in window)) { throw alert("LinearAccelerationSensor not supported"); }
    if (!('AbsoluteOrientationSensor' in window)) { throw alert("AbsoluteOrientationSensor not supported"); }

    this.ws = createServerWebSocket({ host, path: `/racket/${id}`, ...callbacks });

    const send = (data: ChangeData) => {
      if (this.ws.readyState === this.ws.CLOSING || this.ws.readyState === this.ws.CLOSED) {
        throw Error('connection closed');
      }

      if (this.ws.readyState === this.ws.OPEN) {
        this.ws.send(JSON.stringify(data));
      }
    };

    startAccelerometer(send);
    startOrientationTracker(send);
  }
}