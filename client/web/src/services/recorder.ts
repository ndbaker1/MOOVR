export class Recorder {

    public static async capture(callback: (_: ImageData) => any, frameRate = 10) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!; // we are sure that we can obtain the context
        const video = document.createElement('video');
        const [width, height] = [150, 150];

        const stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
                frameRate,
                width: { ideal: width },
                height: { ideal: height },
                facingMode: { ideal: 'environment' }
            }
        });

        video.srcObject = stream;
        video.play();

        const interval = setInterval(() => {
            ctx.drawImage(video, 0, 0);
            callback(ctx.getImageData(0, 0, width, height));
        }, 1000 / frameRate);

        return () => {
            clearInterval(interval);
            canvas.remove();
            video.remove();
        };
    }
}