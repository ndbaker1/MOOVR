import { h } from 'preact';
import * as THREE from 'three';
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader";
import { useRef } from 'preact/hooks';
import { RacketClient } from '../services/clients/racket';
import { ObserverClient } from '../services/clients/observer';

const App = () => {

    const mainRef = useRef(document.createElement('main'))

    return (
        <div id="app">
            <div style={{ position: 'absolute' }}>
                <button onClick={() => initObserverView({ domElementRef: mainRef.current }, new ObserverClient(0))} >
                    observer
                </button>
                <button onClick={() => new RacketClient(0)} >
                    racket 0
                </button>
                <button onClick={() => new RacketClient(1)} >
                    racket 1
                </button>
            </div>
            <main id="canvas" ref={mainRef} />
        </div>
    )
}

export default App;


type ObserverParameters = { domElementRef: HTMLElement }

async function loadMeshes() {

    const loader = new OBJLoader()

    const models = await loader.loadAsync('../assets/phone-pong.obj')

    const racketMesh = models.children[1] as THREE.Mesh
    racketMesh.material = new THREE.MeshNormalMaterial();

    const ballMesh = models.children[0] as THREE.Mesh

    return {
        racketMesh,
        ballMesh,
    }
}


async function initObserverView(parameters: ObserverParameters, observerClient: ObserverClient) {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(80, window.innerWidth / window.innerHeight);
    camera.position.set(-500, 500, 0)
    camera.lookAt(0, 0, 0)

    const { ballMesh, racketMesh } = await loadMeshes()

    // get ball geometry
    // const geometry = new THREE.SphereGeometry(0.2, 20, 20);
    const rackets = new Map<string, THREE.Mesh>()

    const renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setAnimationLoop(animation);
    parameters.domElementRef.replaceChildren(renderer.domElement);

    // animation
    observerClient.ws.addEventListener('message', ({ data }) => {
        const playerDatas = ObserverClient.asPlayerData(data)

        Object.entries(playerDatas).forEach(([id, playerData]) => {

            // logic for adding new meshes when a new player connects
            if (!rackets.has(id)) {
                const racket = racketMesh.clone()
                rackets.set(id, racket)
                scene.add(racket)
            }
            const racket = rackets.get(id)!

            {
                const [x, y, z, w] = playerData.rotation
                // flip y and z based on how we interpret them.
                const quaternion = racket.quaternion.fromArray([x, z, y, w]).invert()
                // reverse the X and Y rotation,
                // which means mirror the XY plane (negation of the Z and W values).
                quaternion.z *= -1
                quaternion.w *= -1
            }

            {
                // racket.position.fromArray(playerData.position)
            }

        })
    })

    function animation(time: number) {
        renderer.render(scene, camera);
    }
}