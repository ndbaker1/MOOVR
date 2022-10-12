export type Vec3 = [number, number, number]
export type Quaternion = [number, number, number, number]

export type Pose = {
    /// 3D coordinate of the player
    position: Vec3,
    /// measures in 180 degrees
    orientation: Quaternion,
}

