import { DynamicClient, type DynamicClientParameters } from "./dynamic";

export class ObserverClient extends DynamicClient {
    constructor(id: number, params: DynamicClientParameters) {
       super(id, params, 'observer');
    }
}
