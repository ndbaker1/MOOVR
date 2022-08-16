import { DynamicClient, type DynamicClientParameters } from "./dynamic";

export class RacketClient extends DynamicClient {
  constructor(id: number, params: DynamicClientParameters) {
    super(id, params, 'racket');
  }
}