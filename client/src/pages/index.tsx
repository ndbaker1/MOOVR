import React from "react";
import Editor from "@monaco-editor/react";
import { AccessPoint, FileArrowLeft } from "tabler-icons-react";
import { ActionIcon, Button, Dialog, Drawer, Group, Loader, Menu, SimpleGrid, Stack, TextInput, Tooltip } from "@mantine/core";

import * as THREE from 'three';
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader";

import { ObserverClient, RacketClient } from "@services/clients";
import { BASE_PATH, WS_HOST } from "../../environment";

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
                          const newObserverClient = new ObserverClient(i, webSocketHost, {
                            openCallback: () => {
                              setObserverClient(client => {
                                if (client) { client.ws.close(); }
                                initObserverView({ code: renderCode }, newObserverClient);
                                setObserverClientLoading(false);
                                return newObserverClient;
                              });
                            }
                          });
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

function useHost(defaultHost: string) {
  const [host, setHost] = React.useState('');
  // replace everything before the '://' part of the url, and remove trailing '/'
  const webSocketHost = (host || defaultHost).replaceAll(/.*:\/\/|\/$/gi, '');
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

  const customRender = new Function('id', 'playerData', 'rackets', 'racketMesh', 'scene', parameters.code ?? '');
  // animation
  observerClient.ws.addEventListener('message', ({ data }) => {
    const playerDatas = ObserverClient.asPlayerData(data);

    Object.entries(playerDatas).forEach(([id, playerData]) => {
      if (parameters.code) {
        customRender(id, playerData, rackets, racketMesh, scene);
      } else {
        // logic for adding new meshes when a new player connects
        if (!rackets.has(id)) {
          const racket = racketMesh.clone();
          rackets.set(id, racket);
          scene.add(racket);
        }
        const racket = rackets.get(id)!;

        racket.quaternion.fromArray(playerData.rotation);
        racket.position.fromArray(playerData.position);
      }
    });
  });

  function animation(time: number) {
    renderer.render(scene, camera);
  }
}

const baseRenderCode = `
// logic for adding new meshes when a new player connects
if (!rackets.has(id)) {
  const racket = racketMesh.clone()
  rackets.set(id, racket)
  scene.add(racket)
}
const racket = rackets.get(id)

racket.quaternion.fromArray(playerData.rotation)
racket.position.fromArray(playerData.position)
`;