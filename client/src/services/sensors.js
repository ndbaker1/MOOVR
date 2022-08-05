import { AxisUpdate } from "./data";

const frequency = 60;

export async function startOrientationTracker(sendCallback) {
    // eslint-disable-next-line no-undef
    const sensor = new AbsoluteOrientationSensor({
        frequency,
        referenceFrame: 'device',
    });
    const permissionResults = await Promise.all([
        navigator.permissions.query({ name: "accelerometer" }),
        navigator.permissions.query({ name: "magnetometer" }),
        navigator.permissions.query({ name: "gyroscope" }),
    ])

    sensor.addEventListener('reading', () => {
        sendCallback(new AxisUpdate('orientation', [sensor.quaternion[0], sensor.quaternion[1], sensor.quaternion[2]]))
    });
    sensor.addEventListener('error', console.log)

    if (permissionResults.every((result) => result.state === "granted")) {
        console.log('yesys');
        sensor.start();
        // …
    } else {
        console.log("No permissions to use AbsoluteOrientationSensor.");
    }
}


export async function startAccelerometer(sendCallback) {
    // eslint-disable-next-line no-undef
    let sensor = new LinearAccelerationSensor({
        frequency
    });

    sensor.addEventListener('reading', () => {
        sendCallback(new AxisUpdate('acceleration', [sensor.x, sensor.y, sensor.z]))
    });
    sensor.addEventListener('error', console.log)

    sensor.start();
}