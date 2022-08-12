import React from "react";
import Editor from "@monaco-editor/react";
import { AccessPoint, FileArrowLeft } from "tabler-icons-react";
import { ActionIcon, Button, Dialog, Drawer, Group, Loader, Menu, SimpleGrid, Stack, TextInput, Tooltip } from "@mantine/core";

import * as THREE from 'three';
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader";

import { ObserverClient, RacketClient } from "@services/clients";
import { BASE_PATH, WS_HOST } from "../../environment";
import type { PlayerData } from "@services/data";

declare global {
  function debug(): void;
}

const Home = () => {
  const [debug, setDebug] = React.useState(false);
  const [showEditor, setShowEditor] = React.useState(false);
  const [renderCode, setRenderCode] = React.useState(baseRenderCode);
  // attach the debug caller to the window object
  React.useEffect(() => { window.debug = () => setDebug(true); }, []);

  const [racketClient, setRacketClient] = React.useState<RacketClient>();
  const [racketClientLoading, setRacketClientLoading] = React.useState(false);
  const [observerClient, setObserverClient] = React.useState<ObserverClient>();
  const [observerClientLoading, setObserverClientLoading] = React.useState(false);

  const { host, setHost, webSocketHost } = useHost(WS_HOST);

  return (
    <div id="app">
      <Dialog
        opened={true}
        size={"min(90vw, 30rem)"} >
        <Stack>
          {debug ? <Button onClick={() => setShowEditor(true)}>Show Editor</Button> : <></>}
          <Group grow>
            <Menu shadow="md">
              <Menu.Target>
                <Button>
                  {observerClientLoading
                    ? <Loader color={"white"} size={"sm"} />
                    : observerClient ? `Observer ${observerClient.id}` : "Connect Observer"
                  }
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                <SimpleGrid cols={3}>
                  {Array(9).fill(0).map((_, i) =>
                    <Group grow key={i}>
                      <ActionIcon
                        size="xl"
                        onClick={() => {
                          setObserverClientLoading(true);
                          const updateObserverClient = () => {
                            const client = new ObserverClient(i, webSocketHost, {});
                            initObserverView({ code: renderCode }, client);
                            setObserverClient(client);
                            setObserverClientLoading(false);
                          };
                          if (observerClient) {
                            observerClient.ws.addEventListener('close', updateObserverClient);
                            observerClient.ws.close();
                          } else {
                            updateObserverClient();
                          }
                        }}
                      >
                        {i}
                      </ActionIcon>
                    </Group>
                  )}
                </SimpleGrid>
              </Menu.Dropdown>
            </Menu>

            <Menu shadow="md">
              <Menu.Target>
                <Button>
                  {racketClientLoading
                    ? <Loader color={"white"} size={"sm"} />
                    : racketClient ? `Racket ${racketClient.id}` : "Connect Racket"
                  }
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                <SimpleGrid cols={3}>
                  {Array(9).fill(0).map((_, i) =>
                    <Group grow key={i}>
                      <ActionIcon
                        size="xl"
                        onClick={() => {
                          setRacketClientLoading(true);
                          const updateRacketClient = () => {
                            const client = new RacketClient(i, webSocketHost, {});
                            client.initSensors();
                            setRacketClient(client);
                            setRacketClientLoading(false);
                          };
                          if (racketClient) {
                            racketClient.ws.addEventListener('close', updateRacketClient);
                            racketClient.ws.close();
                          } else {
                            updateRacketClient();
                          }
                        }}
                      >
                        {i}
                      </ActionIcon>
                    </Group>
                  )}
                </SimpleGrid>
              </Menu.Dropdown>
            </Menu>
          </Group>
          <Group grow>
            <TextInput
              icon={<AccessPoint />}
              rightSection={
                <Tooltip label="paste">
                  <ActionIcon onClick={() => navigator.clipboard.readText().then(setHost)}>
                    <FileArrowLeft />
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

      <Drawer
        position="right"
        size="60vw"
        opened={showEditor}
        onClose={() => setShowEditor(false)}
      >
        <Editor
          value={renderCode}
          onChange={value => setRenderCode(value ?? '')}
          language="javascript"
          theme="vs-dark"
        />
      </Drawer>
      <main id="screen"></main>
    </div >
  );
};

function useHost(defaultHostInput: string) {
  const [host, setHost] = React.useState('');
  // replace everything before the '://' part of the url, and remove trailing '/'
  const webSocketHost = (host || defaultHostInput).replaceAll(/.*:\/\/|\/$/gi, '');
  return { host, setHost, webSocketHost };
}

export default Home;


type RenderParameters = {
  code?: string
}

async function loadMeshes() {

  const loader = new OBJLoader();

  const models = await loader.loadAsync(`${BASE_PATH}/assets/phone-pong.obj`);

  const racketMesh = models.children[1] as THREE.Mesh;
  racketMesh.material = new THREE.MeshNormalMaterial();

  const ballMesh = models.children[0] as THREE.Mesh;
  ballMesh.material = new THREE.MeshNormalMaterial();

  return {
    racketMesh,
    ballMesh,
  };
}


async function initObserverView(parameters: RenderParameters, observerClient: ObserverClient) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(80, window.innerWidth / window.innerHeight, 0.1, 10000);
  camera.position.set(-1000, 0, 0);
  camera.lookAt(0, 0, 0);

  const { ballMesh, racketMesh } = await loadMeshes();

  // get ball geometry
  // const geometry = new THREE.SphereGeometry(0.2, 20, 20);
  const rackets = new Map<string, THREE.Mesh>();

  const renderer = new THREE.WebGLRenderer();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setAnimationLoop(animation);
  const screen = document.querySelector('main[id="screen"]');
  if (screen) {
    screen.replaceChildren(renderer.domElement);
  } else {
    throw Error('failed to replace screen with renderer.');
  }

  // Renderer to run for the client,
  // which can be custom edited from the debug window of the app
  const observerRender: (playerData: PlayerData, racket: THREE.Mesh) => void = parameters.code ?
    new Function('playerData', 'racket', parameters.code) as any
    : (playerData, racket) => {
      racket.quaternion.fromArray(playerData.rotation);
      racket.position.fromArray(playerData.position);
    };

  // Update the geometry of the scene using PlayerData
  const update = (updates: Record<string, PlayerData>) => {
    Object.entries(updates).forEach(([id, playerData]) => {
      // logic for adding new meshes when a new player connects
      if (!rackets.has(id)) {
        const racket = racketMesh.clone();
        rackets.set(id, racket);
        scene.add(racket);
      }

      observerRender(playerData, rackets.get(id)!);
    });
  };

  // Trigger scene update upon each message recieved from the server
  observerClient.ws.addEventListener('message', ({ data }) => update(ObserverClient.asPlayerData(data)));

  function animation(time: number) {
    renderer.render(scene, camera);
  }
}

const baseRenderCode = `
racket.quaternion.fromArray(playerData.rotation)
racket.position.fromArray(playerData.position)
`;