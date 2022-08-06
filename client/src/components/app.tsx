import { h, Ref } from 'preact';
import * as THREE from 'three';
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader";
import { MutableRef, useEffect, useRef, useState } from 'preact/hooks';
import { RacketClient } from '../services/clients/racket';
import { ObserverClient } from '../services/clients/observer';
import { PlayerData } from '../services/data';

const loader = new OBJLoader()

const App = () => {

    const mainRef = useRef(document.createElement('main'))
    const [observerClient, setObserverClient] = useState<ObserverClient>()
    const [racketClient, setRacketClient] = useState<RacketClient>()

    return (
        <div id="app">
            <div style={{ position: 'absolute' }}>
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
            </div>

            <main id="canvas" ref={mainRef} />
        </div>
    )


    function initObserverView(observerClient: ObserverClient) {
        const camera = new THREE.PerspectiveCamera(80, window.innerWidth / window.innerHeight);
        camera.position.set(50, 0, 0)
        const scene = new THREE.Scene();
        camera.lookAt(scene.position)


        // const geometry = new THREE.SphereGeometry(0.2, 20, 20);
        const geometry = new THREE.BoxGeometry(2, 2, 8);
        // const geometry = new THREE.ConeGeometry(0.2, 0.2);
        const material = new THREE.MeshNormalMaterial();
        const racket = new THREE.Mesh(geometry, material);
        scene.add(racket);

        loader.load(
            '../assets/Ping pong paddle.obj',
            model => {
                model.traverse(child => {
                    if (child instanceof THREE.Mesh) {
                        child.material.color = '0xffb830'
                    }
                })
                model.position.set(0, 20, 0)
                scene.add(model)
            },
            progress => console.log('progress', progress),
            error => console.error('loading error', error),
        )


        const renderer = new THREE.WebGLRenderer();
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setAnimationLoop(animation);
        mainRef.current.replaceChildren(renderer.domElement);

        // animation
        observerClient.ws.addEventListener('message', ({ data }) => {
            const playerDatas: Record<number, PlayerData> = JSON.parse(data)
            const playerData = playerDatas[0]

            {
                const [x, y, z, w] = playerData.rotation
                // flip y and z based on how we interpret them.
                const quaternion = racket.quaternion.fromArray([x, z, y, w]).invert()
                // reverse the X and Y rotation,
                // which means mirror the XY plane (negation of the Z and W values).
                quaternion.z *= -1
                quaternion.w *= -1
            }

            racket.position.fromArray(playerData.position)
        })

        function animation(time: number) {
            renderer.render(scene, camera);
        }
    }

}

export default App;
