const frequency = 60;

export async function startOrientationTracker(sendCallback) {
    if (!(await Promise.all([
        navigator.permissions.query({ name: "accelerometer" }),
        navigator.permissions.query({ name: "magnetometer" }),
        navigator.permissions.query({ name: "gyroscope" }),
    ])).every(permissionResult => permissionResult.state === 'granted')) {
        throw new Error('failed to get permission for orientation sensors');
    }

    // eslint-disable-next-line no-undef
    const sensor = new AbsoluteOrientationSensor({
        frequency,
        referenceFrame: 'device',
    });

    sensor.addEventListener('reading', () => {
        try {
            sendCallback({ type: "Rotation", data: sensor.quaternion });
        } catch (e) {
            console.error(e);
            sensor.stop();
        }
    });
    sensor.addEventListener('error', console.log);

    sensor.start();

    return () => sensor.stop();
}


export async function startAccelerometer(sendCallback) {
    if (!(await Promise.all([
        navigator.permissions.query({ name: "accelerometer" }),
        navigator.permissions.query({ name: "magnetometer" }),
        navigator.permissions.query({ name: "gyroscope" }),
    ])).every(permissionResult => permissionResult.state === 'granted')) {
        throw new Error('failed to get accelerometer');
    }

    // eslint-disable-next-line no-undef
    let sensor = new LinearAccelerationSensor({
        frequency
    });

    sensor.addEventListener('reading', () => {
        try {
            sendCallback({ type: "Acceleration", data: [sensor.x, sensor.y, sensor.z] });
        } catch (e) {
            console.error(e);
            sensor.stop();
        }
    });
    sensor.addEventListener('error', console.log);

    sensor.start();

    return () => sensor.stop();
}