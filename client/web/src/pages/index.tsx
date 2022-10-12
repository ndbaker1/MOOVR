import React from "react";
import Editor from "@monaco-editor/react";
import { AccessPoint, FileArrowLeft } from "tabler-icons-react";
import { ActionIcon, Button, Dialog, Drawer, Group, Loader, Menu, SimpleGrid, Stack, TextInput, Tooltip } from "@mantine/core";

import * as THREE from 'three';
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader";

import { EyeClient, RacketClient, ObserverClient } from "@services/clients";
import type { Pose } from "@services/data";

import { BASE_PATH, WS_HOST } from "../../environment";
import { Recorder } from "@services/recorder";


declare global {
  function debug(): void;
}

const Home = () => {
  const [debug, setDebug] = React.useState(false);
  const [showEditor, setShowEditor] = React.useState(false);
  const [renderCode, setRenderCode] = React.useState('');
  // attach the debug caller to the window object
  React.useEffect(() => { window.debug = () => setDebug(true); }, []);

  const [showControl, setShowControl] = React.useState(true);

  const [racketClient, setRacketClient] = React.useState<RacketClient>();
  const [racketClientLoading, setRacketClientLoading] = React.useState(false);
  const [eyeClient, setEyeClient] = React.useState<EyeClient>();
  const [eyeClientLoading, setEyeClientLoading] = React.useState(false);

  const { host, setHost, webSocketHost } = useHost(WS_HOST);

  const loadObserver = (i: number) => {
    setShowControl(false);
    setEyeClientLoading(true);
    const updateObserverClient = () => {
      const client = new EyeClient(i - 1, { host: webSocketHost, callbacks: {} });
      Recorder.capture((im) => client.send(im.data));
      client.initSensors();
      initObserverView({ code: renderCode }, new ObserverClient(i, { host: webSocketHost, callbacks: {} }));
      setEyeClient(client);
      setEyeClientLoading(false);
    };
    if (eyeClient && eyeClient.ws.readyState !== WebSocket.CLOSED) {
      eyeClient.ws.addEventListener('close', updateObserverClient);
      eyeClient.ws.close();
    } else {
      updateObserverClient();
    }
  };

  const loadRacket = (i: number) => {
    setShowControl(false);
    setRacketClientLoading(true);
    const updateRacketClient = () => {
      const client = new RacketClient(i, { host: webSocketHost, callbacks: {} });
      Recorder.capture((im) => client.send(im.data));
      client.initSensors();
      setRacketClient(client);
      setRacketClientLoading(false);
    };
    if (racketClient && racketClient.ws.readyState !== WebSocket.CLOSED) {
      racketClient.ws.addEventListener('close', updateRacketClient);
      racketClient.ws.close();
    } else {
      updateRacketClient();
    }
  };

  React.useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const clientType = searchParams.get('client');
    const id = parseInt(searchParams.get('id') || '');
    switch (clientType) {
      case 'racket': loadRacket(id); break;
      case 'observer': loadObserver(id); break;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div id="app">
      <Dialog
        opened={showControl}
        size={"min(90vw, 30rem)"} >
        <Stack>
          {debug ? <Button onClick={() => setShowEditor(true)}>Show Editor</Button> : <></>}
          <Group grow>
            <Menu shadow="md">
              <Menu.Target>
                <Button>
                  {eyeClientLoading
                    ? <Loader color={"white"} size={"sm"} />
                    : eyeClient ? `View ${eyeClient.id + 1}` : "Connect View"
                  }
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                <SimpleGrid cols={3}>
                  {Array(4).fill(0).map((_, i) => i * 3 + 2).map(i =>
                    <Group grow key={i}>
                      <ActionIcon
                        size="xl"
                        onClick={() => loadObserver(i)}
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
                  {Array(4).fill(0).map((_, i) => i * 3).map(i =>
                    <Group grow key={i}>
                      <ActionIcon
                        size="xl"
                        onClick={() => loadRacket(i)}
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

export default Home;


function useHost(defaultHostInput: string) {
  const [host, setHost] = React.useState('');
  // replace everything before the '://' part of the url, and remove trailing '/'
  const webSocketHost = (host || defaultHostInput).replaceAll(/.*:\/\/|\/$/gi, '');
  return { host, setHost, webSocketHost };
}

type RenderParameters = {
  code?: string
}

async function loadMeshes() {

  const loader = new OBJLoader();
  const material = new THREE.MeshNormalMaterial();

  const groups = await Promise.all([
    loader.loadAsync(`${BASE_PATH}/assets/models.obj`),
    loader.loadAsync(`${BASE_PATH}/assets/table.obj`),
  ]);

  for (const group of groups) {
    group.traverse(obj => obj instanceof THREE.Mesh && (obj.material = material));
  }
  const [objectGroup, tableGroup] = groups;

  const ballMesh = objectGroup.getObjectByName('ball') as THREE.Mesh;
  const racketMesh = objectGroup.getObjectByName('racket') as THREE.Mesh;
  const headMesh = objectGroup.getObjectByName('head') as THREE.Mesh;

  return {
    ballMesh,
    racketMesh,
    headMesh,
    tableGroup,
  };
}


async function initObserverView(parameters: RenderParameters, observerClient: ObserverClient) {

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(80, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(2, 0, 0);
  camera.lookAt(0, 0, 0);

  const { ballMesh, tableGroup, racketMesh, headMesh } = await loadMeshes();

  scene.add(tableGroup);
  // scene.add(ballMesh);
  // get ball geometry
  // const geometry = new THREE.SphereGeometry(0.2, 20, 20);
  const meshes = new Map<number, THREE.Mesh>();
  const createMesh = (id: number) => {
    if (id % 3 == 0) {
      return racketMesh.clone();
    } else if (id % 3 == 1) {
      return headMesh.clone();
    } else {
      throw new Error('dont recieve events from observers');
    }
  };

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
  const observerRender: (id: number, playerPose: Pose, object?: THREE.Mesh) => void = !!parameters.code
    ? new Function('id', 'playerData', 'object', parameters.code) as any
    : (id, playerPose, object) => {
      if (id == observerClient.id - 1) {
        camera.quaternion.fromArray(playerPose.orientation);
        camera.position.fromArray(playerPose.position);
      } else {
        if (object) {
          object.quaternion.fromArray(playerPose.orientation);
          object.position.fromArray(playerPose.position);
        } else {
          console.error(`no mesh provided for body that needs to be drawn with id [${id}]`);
        }
      }
    };

  // Update the geometry of the scene using PlayerData
  const update = (updates: Record<string, Pose>) => {
    Object.entries(updates).forEach(([idKey, playerPose]) => {
      const id = parseInt(idKey);
      // logic for adding new meshes when a new player connects
      if (!meshes.has(id) && observerClient.id != id) {
        const mesh = createMesh(id);
        meshes.set(id, mesh);
        scene.add(mesh);
        console.log('created mesh for id', id);
      }

      observerRender(id, playerPose, meshes.get(id)!);
    });
  };

  // Trigger scene update upon each message recieved from the server
  observerClient.ws.addEventListener('message', ({ data }) => update(EyeClient.asPlayerPose(data)));

  function animation(time: number) {
    renderer.render(scene, camera);
  }
}