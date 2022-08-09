import { ActionIcon, Button, Dialog, Group, Menu, SimpleGrid, Stack, TextInput, Tooltip } from "@mantine/core";
import React from "react";
import { AccessPoint, FileArrowLeft } from "tabler-icons-react";
import * as THREE from 'three';
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader";
import { BASE_PATH, WS_HOST } from "../environment";
import { ObserverClient } from "../services/clients/observer";
import { RacketClient } from "../services/clients/racket";

const Home = () => {

  const [controlOpen, setControlOpen] = React.useState(true)
  const { host, setHost, webSocketHost } = useHost(WS_HOST)

  return (
    <div id="app">
      <Dialog
        opened={controlOpen}
        withCloseButton
        onClose={() => setControlOpen(false)}
        size={"min(90vw, 30rem)"} >
        <Stack>
          <Group grow>
            <Menu shadow="md">
              <Menu.Target>
                <Button>Observer Client</Button>
              </Menu.Target>
              <Menu.Dropdown>
                <SimpleGrid cols={3}>
                  {[...Array(9).keys()].map(i =>
                    <Group grow key={i}>
                      <ActionIcon size="xl" onClick={() => initObserverView({}, new ObserverClient(i, webSocketHost))}>{i}</ActionIcon>
                    </Group>
                  )}
                </SimpleGrid>
              </Menu.Dropdown>
            </Menu>

            <Menu shadow="md">
              <Menu.Target>
                <Button>Racket Client</Button>
              </Menu.Target>
              <Menu.Dropdown>
                <SimpleGrid cols={3}>
                  {[...Array(9).keys()].map(i =>
                    <Group grow key={i}>
                      <ActionIcon size="xl" onClick={() => new RacketClient(i, webSocketHost)}>{i}</ActionIcon>
                    </Group>
                  )}
                </SimpleGrid>
              </Menu.Dropdown>
            </Menu>
          </Group>
            <Group grow>
            <TextInput
              icon={<AccessPoint/>}
              rightSection={
                <Tooltip label="paste">
                  <ActionIcon onClick={() => navigator.clipboard.readText().then(setHost)}>
                    <FileArrowLeft/>
                  </ActionIcon>
                </Tooltip>
              }
              placeholder={WS_HOST}
              onChange={e => setHost(e.target.value)}
              width={"100%"}
              value={host} />
          </Group>
        </Stack>
      </Dialog>

      <main id="screen"></main>
    </div>
  )
}

function useHost(defaultHost: string) {
  const [host, setHost] = React.useState('')
  const webSocketHost = (host || defaultHost).replaceAll(/.*:\/\/|\/$/gi, '')
  return { host, setHost, webSocketHost }
}

export default Home;


type ObserverParameters = {}



async function loadMeshes() {

  const loader = new OBJLoader()

  const models = await loader.loadAsync(`${BASE_PATH}/assets/phone-pong.obj`)

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
  const camera = new THREE.PerspectiveCamera(80, window.innerWidth / window.innerHeight, 0.1, 10000);
  camera.position.set(-500, 0, 0)
  camera.lookAt(0, 0, 0)

  const { ballMesh, racketMesh } = await loadMeshes()

  // get ball geometry
  // const geometry = new THREE.SphereGeometry(0.2, 20, 20);
  const rackets = new Map<string, THREE.Mesh>()

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setAnimationLoop(animation);
  const screen = document.querySelector('main[id="screen"]')
  if (screen) {
    screen.replaceChildren(renderer.domElement);
  } else {
    throw Error('failed to replace screen with renderer.')
  }

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
        const [x, y, z] = playerData.position.map(i => i * 2000)
        // racket.position.fromArray([x, y, z])
        // racket.position.fromArray([x, y, z])
      }

    })
  })

  function animation(time: number) {
    renderer.render(scene, camera);
  }
}
