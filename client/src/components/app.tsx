import { h } from 'preact';
import * as THREE from 'three';
import { useEffect, useRef, useState } from 'preact/hooks';
import { RacketClient } from '../services/clients/racket';
import { ObserverClient } from '../services/clients/observer';
import { PlayerData } from 'src/services/data';

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
    const camera = new THREE.PerspectiveCamera(90, window.innerWidth / window.innerHeight, 0.01, 10);
    camera.position.z = 1;

    const scene = new THREE.Scene();

    // const geometry = new THREE.SphereGeometry(0.2, 20, 20);
    const geometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);
    const material = new THREE.MeshNormalMaterial();
    const ball = new THREE.Mesh(geometry, material);
    scene.add(ball);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setAnimationLoop(animation);
    document.body.appendChild(renderer.domElement);

    // animation
    observerClient.ws.addEventListener('message', ({ data }) => {
        const playerDatas: Record<number, PlayerData> = JSON.parse(data)
        const playerData = playerDatas[0]

        console.log(playerData)
        ball.position.x = playerData.position[0]
        ball.position.y = playerData.position[1]
        ball.position.z = playerData.position[2]

        ball.rotation.x = playerData.rotation[0]
        ball.rotation.y = playerData.rotation[1]
        ball.rotation.z = playerData.rotation[2]
    })

    function animation(time: number) {
        renderer.render(scene, camera);
    }
}

export default App;
