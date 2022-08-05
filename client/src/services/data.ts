export class AxisUpdate {
    // eslint-disable-next-line no-useless-constructor
    constructor(
        public type: 'orientation' | 'acceleration',
        public axis_data: [number, number, number],
    ) { }

    public intoJson(): string {
        return JSON.stringify({
            user: 0,
            ...this,
        })
    }
}

export type AxisData = [number, number, number]

export type PlayerData = {
    /// 3D coordinate of the player
    position: AxisData,
    /// velocity of the player's racket
    velocity: AxisData,
    /// measures in 180 degrees
    rotation: AxisData,
}

