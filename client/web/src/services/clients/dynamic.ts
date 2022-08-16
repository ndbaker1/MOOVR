import { startAccelerometer, startOrientationTracker } from "@services/sensors";

import { type WebSocketCallbacks, createServerWebSocket } from "../connection";
import type { ChangeData, PlayerData } from "../data";

export type DynamicClientParameters = {
  host: string,
  callbacks: WebSocketCallbacks,
}

export class DynamicClient {
    public ws: WebSocket;

    constructor(public id: number, { host, callbacks }: DynamicClientParameters, type: string) {
        this.ws = createServerWebSocket({ host, path: `/${type}/${id}`, ...callbacks });
    }

    public static asPlayerData(data: unknown): Record<number, PlayerData> {
        if (typeof data === 'string') {
            return JSON.parse(data);
        }
        throw Error('invalid data');
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

        const killHandles = await Promise.all([
          startAccelerometer(send),
          startOrientationTracker(send),
        ]);

        this.ws.addEventListener('error', () => killHandles.forEach(kill => kill()));
        this.ws.addEventListener('close', () => killHandles.forEach(kill => kill()));
      }
}
