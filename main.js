import * as THREE from 'three';
import Stats from 'three/addons/libs/stats.module.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Octree } from 'three/addons/math/Octree.js';
import { OctreeHelper } from 'three/addons/helpers/OctreeHelper.js';
import { Capsule } from 'three/addons/math/Capsule.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';

// =========================
// TEMPORIZADOR
// =========================
const timer = new THREE.Timer();
timer.connect(document);

// =========================
// ESCENA
// =========================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xe5e9ee);
scene.fog = new THREE.Fog(0xe5e9ee, 8, 80);

// =========================
// CÁMARA
// =========================
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.rotation.order = 'YXZ';

// =========================
// RENDERER
// =========================
const container = document.getElementById('container') || document.body;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setAnimationLoop(animate);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
container.appendChild(renderer.domElement);

// =========================
// STATS
// =========================
const stats = new Stats();
stats.dom.style.position = 'absolute';
stats.dom.style.top = '0px';
stats.dom.style.left = '0px';
stats.dom.style.zIndex = '999';
document.body.appendChild(stats.dom);

// =========================
// LUCES
// =========================
const hemiLight = new THREE.HemisphereLight(0xddeeff, 0x5e5645, 1.5);
scene.add(hemiLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 2.2);
directionalLight.position.set(12, 20, 10);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.set(2048, 2048);
directionalLight.shadow.camera.near = 0.1;
directionalLight.shadow.camera.far = 200;
directionalLight.shadow.camera.left = -40;
directionalLight.shadow.camera.right = 40;
directionalLight.shadow.camera.top = 40;
directionalLight.shadow.camera.bottom = -40;
directionalLight.shadow.bias = -0.00008;
scene.add(directionalLight);

const fillLight = new THREE.DirectionalLight(0xffffff, 0.45);
fillLight.position.set(-8, 10, -8);
scene.add(fillLight);

// =========================
// SUELO AUXILIAR
// =========================
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(250, 250),
  new THREE.MeshStandardMaterial({
    color: 0xd6dbe2,
    roughness: 1
  })
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.02;
ground.receiveShadow = true;
scene.add(ground);

// =========================
// PARÁMETROS
// =========================
const GRAVITY = 30;
const STEPS_PER_FRAME = 5;
const MAX_PLAYER_SPEED = 10;
const PLAYER_RADIUS = 0.35;
const PLAYER_HEIGHT = 1.75;

const params = {
  showOctree: false,
  fogNear: 8,
  fogFar: 80,
  exposure: 1.0
};

// =========================
// INFO DEL MUNDO
// =========================
const worldInfo = {
  center: new THREE.Vector3(),
  size: new THREE.Vector3(),
  box: new THREE.Box3(),
  floorY: 0,
  halfWidth: 4,
  halfDepth: 4,
  modelScale: 1
};

// =========================
// OCTREE
// =========================
const worldOctree = new Octree();
let octreeHelper = null;
let worldReady = false;

// =========================
// JUGADOR
// =========================
const playerCollider = new Capsule(
  new THREE.Vector3(0, PLAYER_RADIUS, 0),
  new THREE.Vector3(0, PLAYER_HEIGHT, 0),
  PLAYER_RADIUS
);

const playerVelocity = new THREE.Vector3();
const playerDirection = new THREE.Vector3();
let playerOnFloor = false;

// =========================
// CONTROLES
// =========================
const keyStates = {};
let pointerLocked = false;

document.addEventListener('keydown', (event) => {
  if (['Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(event.code)) {
    event.preventDefault();
  }
  keyStates[event.code] = true;
});

document.addEventListener('keyup', (event) => {
  keyStates[event.code] = false;
});

container.addEventListener('click', () => {
  container.requestPointerLock();
});

document.addEventListener('pointerlockchange', () => {
  pointerLocked = document.pointerLockElement === container;
});

document.addEventListener('mousemove', (event) => {
  if (!pointerLocked || !worldReady) return;

  camera.rotation.y -= event.movementX / 500;
  camera.rotation.x -= event.movementY / 500;
  camera.rotation.x = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, camera.rotation.x));
});

// =========================
// GUI
// =========================
const gui = new GUI({ width: 260 });
gui.title('Ring FPS');

gui.add(params, 'exposure', 0.4, 2.0, 0.01).name('Exposición').onChange((v) => {
  renderer.toneMappingExposure = v;
});

gui.add(params, 'fogNear', 1, 30, 1).name('Niebla inicio').onChange((v) => {
  scene.fog.near = v;
});

gui.add(params, 'fogFar', 20, 150, 1).name('Niebla fin').onChange((v) => {
  scene.fog.far = v;
});

gui.add(params, 'showOctree').name('Mostrar octree').onChange((value) => {
  if (octreeHelper) octreeHelper.visible = value;
});

// =========================
// HELPERS
// =========================
const axesHelper = new THREE.AxesHelper(3);
axesHelper.visible = false;
scene.add(axesHelper);

// =========================
// AUXILIARES
// =========================
const vector1 = new THREE.Vector3();
const tempBox = new THREE.Box3();
const tempSize = new THREE.Vector3();
const tempCenter = new THREE.Vector3();

// =========================
// DIRECCIÓN
// =========================
function getForwardVector() {
  camera.getWorldDirection(playerDirection);
  playerDirection.y = 0;
  playerDirection.normalize();
  return playerDirection;
}

function getSideVector() {
  camera.getWorldDirection(playerDirection);
  playerDirection.y = 0;
  playerDirection.normalize();
  playerDirection.cross(camera.up);
  return playerDirection;
}

// =========================
// COLISIONES JUGADOR
// =========================
function playerCollisions() {
  const result = worldOctree.capsuleIntersect(playerCollider);

  playerOnFloor = false;

  if (result) {
    playerOnFloor = result.normal.y > 0;

    if (!playerOnFloor) {
      playerVelocity.addScaledVector(result.normal, -result.normal.dot(playerVelocity));
    }

    if (result.depth >= 1e-10) {
      playerCollider.translate(result.normal.multiplyScalar(result.depth));
    }
  }
}

// =========================
// MOVIMIENTO
// =========================
function controls(deltaTime) {
  const speedDelta = deltaTime * (playerOnFloor ? 16 : 6);

  if (keyStates['KeyW']) {
    playerVelocity.add(getForwardVector().multiplyScalar(speedDelta));
  }

  if (keyStates['KeyS']) {
    playerVelocity.add(getForwardVector().multiplyScalar(-speedDelta));
  }

  if (keyStates['KeyA']) {
    playerVelocity.add(getSideVector().multiplyScalar(-speedDelta));
  }

  if (keyStates['KeyD']) {
    playerVelocity.add(getSideVector().multiplyScalar(speedDelta));
  }

  if (playerOnFloor && keyStates['Space']) {
    playerVelocity.y = 10;
  }
}

// =========================
// ACTUALIZAR JUGADOR
// =========================
function updatePlayer(deltaTime) {
  let damping = Math.exp(-4 * deltaTime) - 1;

  if (!playerOnFloor) {
    playerVelocity.y -= GRAVITY * deltaTime;
    damping *= 0.15;
  }

  playerVelocity.addScaledVector(playerVelocity, damping);

  if (playerVelocity.length() > MAX_PLAYER_SPEED) {
    playerVelocity.normalize().multiplyScalar(MAX_PLAYER_SPEED);
  }

  const deltaPosition = playerVelocity.clone().multiplyScalar(deltaTime);
  playerCollider.translate(deltaPosition);

  playerCollisions();
  keepPlayerInsideBounds();

  camera.position.copy(playerCollider.end);
}

// =========================
// LIMITAR JUGADOR AL RING
// =========================
function keepPlayerInsideBounds() {
  const margin = 0.45;

  const minX = worldInfo.center.x - worldInfo.halfWidth + margin;
  const maxX = worldInfo.center.x + worldInfo.halfWidth - margin;
  const minZ = worldInfo.center.z - worldInfo.halfDepth + margin;
  const maxZ = worldInfo.center.z + worldInfo.halfDepth - margin;

  const centerX = (playerCollider.start.x + playerCollider.end.x) * 0.5;
  const centerZ = (playerCollider.start.z + playerCollider.end.z) * 0.5;

  let dx = 0;
  let dz = 0;

  if (centerX < minX) dx = minX - centerX;
  if (centerX > maxX) dx = maxX - centerX;
  if (centerZ < minZ) dz = minZ - centerZ;
  if (centerZ > maxZ) dz = maxZ - centerZ;

  if (dx !== 0 || dz !== 0) {
    playerCollider.translate(new THREE.Vector3(dx, 0, dz));

    if (dx !== 0) playerVelocity.x = 0;
    if (dz !== 0) playerVelocity.z = 0;
  }
}

// =========================
// SPAWN
// =========================
function setPlayerSpawn() {
  const spawnX = worldInfo.center.x;
  const spawnZ = worldInfo.center.z;
  const spawnY = worldInfo.floorY + 1.0;

  playerCollider.start.set(spawnX, spawnY, spawnZ);
  playerCollider.end.set(spawnX, spawnY + (PLAYER_HEIGHT - PLAYER_RADIUS), spawnZ);

  playerVelocity.set(0, 0, 0);

  camera.position.copy(playerCollider.end);
  camera.rotation.set(0, 0, 0);
}

// =========================
// RECUPERACIÓN SI CAE
// =========================
function teleportPlayerIfOob() {
  if (camera.position.y < worldInfo.floorY - 10) {
    setPlayerSpawn();
  }
}

// =========================
// AJUSTAR MODELO
// =========================
function fitModelToRing(root) {
  tempBox.setFromObject(root);
  tempBox.getSize(tempSize);
  tempBox.getCenter(tempCenter);

  const currentMaxXZ = Math.max(tempSize.x, tempSize.z);
  const targetMaxXZ = 14;
  const autoScale = currentMaxXZ > 0 ? targetMaxXZ / currentMaxXZ : 1;

  root.scale.setScalar(autoScale);
  root.updateMatrixWorld(true);

  tempBox.setFromObject(root);
  tempBox.getSize(tempSize);
  tempBox.getCenter(tempCenter);

  root.position.x -= tempCenter.x;
  root.position.z -= tempCenter.z;
  root.position.y -= tempBox.min.y;
  root.updateMatrixWorld(true);

  worldInfo.modelScale = autoScale;
}

// =========================
// CALCULAR INFO DEL MUNDO
// =========================
function computeWorldInfo(root) {
  worldInfo.box.setFromObject(root);
  worldInfo.box.getCenter(worldInfo.center);
  worldInfo.box.getSize(worldInfo.size);
  worldInfo.floorY = worldInfo.box.min.y;

  // Área utilizable interna del ring
  worldInfo.halfWidth = Math.max(2.0, worldInfo.size.x * 0.23);
  worldInfo.halfDepth = Math.max(2.0, worldInfo.size.z * 0.23);

  const maxDim = Math.max(worldInfo.size.x, worldInfo.size.z, 10);

  scene.fog.far = Math.max(40, maxDim * 4);

  directionalLight.shadow.camera.left = -maxDim * 1.8;
  directionalLight.shadow.camera.right = maxDim * 1.8;
  directionalLight.shadow.camera.top = maxDim * 1.8;
  directionalLight.shadow.camera.bottom = -maxDim * 1.8;
  directionalLight.shadow.camera.far = maxDim * 6;
  directionalLight.shadow.needsUpdate = true;

  console.log('Escala modelo:', worldInfo.modelScale);
  console.log('Tamaño mundo:', worldInfo.size);
  console.log('Centro mundo:', worldInfo.center);
  console.log('Mitad útil X:', worldInfo.halfWidth, 'Mitad útil Z:', worldInfo.halfDepth);
}

// =========================
// CARGAR MODELO
// =========================
const loader = new GLTFLoader().setPath('./models/gltf/');

loader.load(
  'ring.glb',
  (gltf) => {
    const model = gltf.scene;

    fitModelToRing(model);

    model.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;

        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((mat) => {
              if ('side' in mat) mat.side = THREE.FrontSide;
            });
          } else {
            child.material.side = THREE.FrontSide;
          }
        }
      }
    });

    scene.add(model);

    computeWorldInfo(model);
    worldOctree.fromGraphNode(model);

    try {
      octreeHelper = new OctreeHelper(worldOctree);
      octreeHelper.visible = params.showOctree;
      scene.add(octreeHelper);
    } catch (e) {
      console.warn('No se pudo crear el OctreeHelper.', e);
      octreeHelper = null;
    }

    setPlayerSpawn();
    worldReady = true;
  },
  (xhr) => {
    if (xhr.total) {
      const percent = (xhr.loaded / xhr.total) * 100;
      console.log(`Cargando ring: ${percent.toFixed(2)}%`);
    }
  },
  (error) => {
    console.error('Error cargando ring.glb:', error);
  }
);

// =========================
// RESIZE
// =========================
window.addEventListener('resize', onWindowResize);

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// =========================
// ANIMACIÓN
// =========================
function animate() {
  timer.update();

  const deltaTime = Math.min(0.05, timer.getDelta()) / STEPS_PER_FRAME;

  if (worldReady) {
    for (let i = 0; i < STEPS_PER_FRAME; i++) {
      controls(deltaTime);
      updatePlayer(deltaTime);
      teleportPlayerIfOob();
    }
  }

  const t = performance.now() * 0.001;
  directionalLight.position.x = Math.sin(t * 0.2) * 10;
  directionalLight.position.z = Math.cos(t * 0.2) * 10;

  renderer.render(scene, camera);
  stats.update();
}