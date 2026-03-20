import * as THREE from 'three';
import Stats from 'three/addons/libs/stats.module.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';

// =========================
// ESCENA
// =========================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xe5e9ee);
scene.fog = new THREE.Fog(0xe5e9ee, 20, 100);

// =========================
// CÁMARA
// =========================
const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(0, 3, 6);

// =========================
// RENDERER
// =========================
const container = document.getElementById('container') || document.body;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
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
const hemiLight = new THREE.HemisphereLight(0xddeeff, 0x6e6655, 1.5);
scene.add(hemiLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 2.0);
dirLight.position.set(12, 20, 10);
dirLight.castShadow = true;
dirLight.shadow.mapSize.set(2048, 2048);
dirLight.shadow.camera.near = 0.1;
dirLight.shadow.camera.far = 100;
dirLight.shadow.camera.left = -30;
dirLight.shadow.camera.right = 30;
dirLight.shadow.camera.top = 30;
dirLight.shadow.camera.bottom = -30;
dirLight.shadow.bias = -0.00008;
scene.add(dirLight);

const fillLight = new THREE.DirectionalLight(0xffffff, 0.5);
fillLight.position.set(-10, 8, -8);
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
// CONTROLES
// =========================
const orbit = new OrbitControls(camera, renderer.domElement);
orbit.enableDamping = true;
orbit.minDistance = 1.5;
orbit.maxDistance = 20;
orbit.maxPolarAngle = Math.PI / 2.02;
orbit.target.set(0, 1.5, 0);

// =========================
// GUI
// =========================
const params = {
  exposure: 1.0,
  fogNear: 20,
  fogFar: 100,
  showHelpers: false
};

const gui = new GUI({ width: 260 });
gui.title('Escenario');

gui.add(params, 'exposure', 0.4, 2.0, 0.01).name('Exposición').onChange((v) => {
  renderer.toneMappingExposure = v;
});

gui.add(params, 'fogNear', 1, 80, 1).name('Niebla inicio').onChange((v) => {
  scene.fog.near = v;
});

gui.add(params, 'fogFar', 20, 200, 1).name('Niebla fin').onChange((v) => {
  scene.fog.far = v;
});

// =========================
// HELPERS
// =========================
const axesHelper = new THREE.AxesHelper(5);
axesHelper.visible = false;
scene.add(axesHelper);

const gridHelper = new THREE.GridHelper(40, 40, 0x666666, 0xaaaaaa);
gridHelper.visible = false;
scene.add(gridHelper);

gui.add(params, 'showHelpers').name('Mostrar helpers').onChange((v) => {
  axesHelper.visible = v;
  gridHelper.visible = v;
});

// =========================
// MODELO
// =========================
const loader = new GLTFLoader();

let worldModel = null;
const modelBox = new THREE.Box3();
const modelSize = new THREE.Vector3();
const modelCenter = new THREE.Vector3();

loader.load(
  './models/gltf/ring.glb', // cambia el nombre si tu archivo se llama distinto
  (gltf) => {
    worldModel = gltf.scene;

    worldModel.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;

        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((mat) => {
              if ('side' in mat) mat.side = THREE.FrontSide;
            });
          } else {
            if ('side' in child.material) child.material.side = THREE.FrontSide;
          }
        }
      }
    });

    scene.add(worldModel);

    // Caja inicial
    modelBox.setFromObject(worldModel);
    modelBox.getSize(modelSize);
    modelBox.getCenter(modelCenter);

    // Centrar modelo en X y Z
    worldModel.position.x -= modelCenter.x;
    worldModel.position.z -= modelCenter.z;

    // Recalcular
    modelBox.setFromObject(worldModel);
    modelBox.getSize(modelSize);
    modelBox.getCenter(modelCenter);

    // Subir modelo para apoyarlo sobre el suelo
    const minY = modelBox.min.y;
    worldModel.position.y += -minY;

    // Recalcular otra vez
    modelBox.setFromObject(worldModel);
    modelBox.getSize(modelSize);
    modelBox.getCenter(modelCenter);

    // Colocar cámara dentro / sobre el ring
    camera.position.set(
      modelCenter.x,
      modelCenter.y + Math.max(1.8, modelSize.y * 0.18),
      modelCenter.z + Math.max(2.5, modelSize.z * 0.18)
    );

    orbit.target.set(
      modelCenter.x,
      modelCenter.y + Math.max(1.2, modelSize.y * 0.12),
      modelCenter.z
    );

    orbit.update();

    console.log('Modelo cargado correctamente');
    console.log('Tamaño:', modelSize);
    console.log('Centro:', modelCenter);
  },
  (xhr) => {
    if (xhr.total) {
      const percent = (xhr.loaded / xhr.total) * 100;
      console.log(`Cargando escenario: ${percent.toFixed(2)}%`);
    }
  },
  (error) => {
    console.error('Error al cargar ./models/gltf/ring.glb', error);
  }
);

// =========================
// RESPONSIVE
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
  orbit.update();
  renderer.render(scene, camera);
  stats.update();
}

renderer.setAnimationLoop(animate);