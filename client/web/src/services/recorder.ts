export class Recorder {

    public static async capture(callback: (_: ImageData) => any, frameRate = 15) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!; // we are sure that we can obtain the context
        const video = document.createElement('video');

        const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { frameRate, width: 300, height: 150 } });
        video.srcObject = stream;
        video.play();

        const interval = setInterval(() => {
            ctx.drawImage(video, 0, 0);
            callback(ctx.getImageData(0, 0, canvas.width, canvas.height));
        }, 1000 / frameRate);

        return () => {
            clearInterval(interval);
            canvas.remove();
            video.remove();
        };
    }
}