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
    ]);

    sensor.addEventListener('reading', () => {
        try {
            sendCallback({ type: "Rotation", data: sensor.quaternion });
        } catch(e) {
            console.error(e);
            sensor.stop();
        }
    });
    sensor.addEventListener('error', console.log);

    if (permissionResults.every((result) => result.state === "granted")) {
        sensor.start();
    } else {
        console.log("No permissions to use AbsoluteOrientationSensor.");
    }

    return () => sensor.stop();
}


export async function startAccelerometer(sendCallback) {
    // eslint-disable-next-line no-undef
    let sensor = new LinearAccelerationSensor({
        frequency
    });

    sensor.addEventListener('reading', () => {
        try {
            sendCallback({ type: "Acceleration", data: [sensor.x, sensor.y, sensor.z] });
        } catch(e) {
            console.error(e);
            sensor.stop();
        }
    });
    sensor.addEventListener('error', console.log);

    sensor.start();

    return () => sensor.stop();
}