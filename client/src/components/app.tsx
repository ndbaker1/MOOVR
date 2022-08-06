import { h } from 'preact';
import * as THREE from 'three';
import { useEffect, useRef, useState } from 'preact/hooks';
import { RacketClient } from '../services/clients/racket';
import { ObserverClient } from '../services/clients/observer';
import { PlayerData } from '../services/data';

const App = () => {

    const [observerClient, setObserverClient] = useState<ObserverClient>()
    const [racketClient, setRacketClient] = useState<RacketClient>()

    return (
        <div id="app">
            <main>
                <button
                    onClick={() => {
                        const observerClient = new ObserverClient(0)
                        setObserverClient(observerClient)
                        initObserverView(observerClient)
                    }}
                >
                    observer
                </button>
                <button
                    onClick={() => setRacketClient(new RacketClient(0))}
                >
                    racket
                </button>
            </main>
        </div>
    )
}

function initObserverView(observerClient: ObserverClient) {
    const camera = new THREE.PerspectiveCamera(80, window.innerWidth / window.innerHeight);
    camera.position.z = 1

    const scene = new THREE.Scene();

    // const geometry = new THREE.SphereGeometry(0.2, 20, 20);
    const geometry = new THREE.ConeGeometry(0.2, 0.2);
    const material = new THREE.MeshNormalMaterial();
    const racket = new THREE.Mesh(geometry, material);
    scene.add(racket);

    const renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setAnimationLoop(animation);
    document.body.appendChild(renderer.domElement);

    // animation
    observerClient.ws.addEventListener('message', ({ data }) => {
        const playerDatas: Record<number, PlayerData> = JSON.parse(data)
        const playerData = playerDatas[0]

        console.log(playerData)
        racket.quaternion.fromArray(playerData.rotation).invert()
    })

    // startOrientationTrackerLocal((sensor: any) => {
    //     ball.quaternion.fromArray(sensor.quaternion).invert()
    // })

    function animation(time: number) {

        console.log(JSON.stringify(racket.rotation))
        renderer.render(scene, camera);
    }
}

export default App;
