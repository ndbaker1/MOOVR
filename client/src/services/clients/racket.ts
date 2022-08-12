import { type WebSocketCallbacks, createServerWebSocket } from "../connection";
import { startAccelerometer, startOrientationTracker } from "../sensors";
import type { ChangeData } from "../data";

export class RacketClient {
  public ws: WebSocket;

  constructor(public id: number, host: string, callbacks: WebSocketCallbacks) {
    if (!('LinearAccelerationSensor' in window)) { throw alert("LinearAccelerationSensor not supported"); }
    if (!('AbsoluteOrientationSensor' in window)) { throw alert("AbsoluteOrientationSensor not supported"); }

    this.ws = createServerWebSocket({ host, path: `/racket/${id}`, ...callbacks });
  }

  public async initSensors() {
    const send = (data: ChangeData) => {
      if (this.ws.readyState === this.ws.CLOSING || this.ws.readyState === this.ws.CLOSED) {
        throw Error('connection closed');
      }

      if (this.ws.readyState === this.ws.OPEN) {
        this.ws.send(JSON.stringify(data));
      }
    };

    const killHandles = [
      await startAccelerometer(send),
      await startOrientationTracker(send),
    ];

    this.ws.addEventListener('error', () => killHandles.forEach(kill => kill()));
    this.ws.addEventListener('close', () => killHandles.forEach(kill => kill()));
  }
}