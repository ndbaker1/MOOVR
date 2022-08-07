import { h } from 'preact';
import * as THREE from 'three';
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader";
import { useRef } from 'preact/hooks';
import { RacketClient } from '../services/clients/racket';
import { ObserverClient } from '../services/clients/observer';
import { PlayerData } from '../services/data';

type ObserverParameters = { any?: any }

const loader = new OBJLoader()

const App = () => {

    const mainRef = useRef(document.createElement('main'))

    return (
        <div id="app">
            <div style={{ position: 'absolute' }}>
                <button onClick={() => initObserverView({}, new ObserverClient(0))} >
                    observer
                </button>
                <button onClick={() => new RacketClient(0)} >
                    racket
                </button>
            </div>

            <main id="canvas" ref={mainRef} />
        </div>
    )


    async function initObserverView(parameters: ObserverParameters, observerClient: ObserverClient) {
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(80, window.innerWidth / window.innerHeight);
        camera.position.set(-500, 500, 0)

        // get ball geometry
        // const geometry = new THREE.SphereGeometry(0.2, 20, 20);

        const racket = await loadRacketMesh()
        scene.add(racket)
        camera.lookAt(racket.position)

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

            // racket.position.fromArray(playerData.position)
        })

        function animation(time: number) {
            renderer.render(scene, camera);
        }
    }
}

function loadRacketMesh() {
    return loader.loadAsync('../assets/phone-pong.obj').then(model => {
        const racket = model.children[1] as THREE.Mesh
        racket.material = new THREE.MeshNormalMaterial();
        return racket
    })
}

function loadBallMesh() {
    return loader.loadAsync('../assets/phone-pong.obj').then(model => {
        const racket = model.children[0] as THREE.Mesh
        return racket
    })
}

export default App;
