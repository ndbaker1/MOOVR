import type { PlayerData } from "../data";
import { DynamicClient, type DynamicClientParameters } from "./dynamic";

export class EyeClient extends DynamicClient {
    constructor(id: number, params: DynamicClientParameters) {
       super(id, params, 'head');
    }

    public static asPlayerData(data: unknown): Record<number, PlayerData> {
        if (typeof data === 'string') {
            return JSON.parse(data);
        }
        throw Error('invalid data');
    }
}
