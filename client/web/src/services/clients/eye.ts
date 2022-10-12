import type { Pose } from "../data";
import { DynamicClient, type DynamicClientParameters } from "./dynamic";

export class EyeClient extends DynamicClient {
    constructor(id: number, params: DynamicClientParameters) {
        super(id, params, 'head');
    }

    public static asPlayerPose(data: unknown): Record<number, Pose> {
        if (typeof data === 'string') {
            return JSON.parse(data);
        }
        throw Error('invalid data');
    }
}
