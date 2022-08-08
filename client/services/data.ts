export type ChangeData = {
    type: 'Rotation',
    data: Quaternion
} | {
    type: 'Acceleration'
    data: Vec3
}

export type Vec3 = [number, number, number]
export type Quaternion = [number, number, number, number]

export type PlayerData = {
    /// 3D coordinate of the player
    position: Vec3,
    /// measures in 180 degrees
    rotation: Quaternion,
}

