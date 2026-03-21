import * as THREE from 'three';
import Stats from 'three/addons/libs/stats.module.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
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
scene.background = new THREE.Color(0xcfd6dd);
scene.fog = new THREE.Fog(0xcfd6dd, 6, 90);

// =========================
// CÁMARA
// =========================
const camera = new THREE.PerspectiveCamera(
    70,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);
camera.rotation.order = 'YXZ';

// =========================
// CONTENEDOR / RENDERER
// =========================
const container = document.getElementById('container') || document.body;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setAnimationLoop(animate);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
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
const hemiLight = new THREE.HemisphereLight(0xe6eef7, 0x5a4b3d, 1.45);
scene.add(hemiLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 2.25);
directionalLight.position.set(-10, 25, 12);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;
directionalLight.shadow.camera.near = 0.1;
directionalLight.shadow.camera.far = 250;
directionalLight.shadow.camera.left = -50;
directionalLight.shadow.camera.right = 50;
directionalLight.shadow.camera.top = 50;
directionalLight.shadow.camera.bottom = -50;
directionalLight.shadow.bias = -0.00008;
scene.add(directionalLight);

const fillLight = new THREE.DirectionalLight(0xffffff, 0.45);
fillLight.position.set(8, 10, -8);
scene.add(fillLight);

// =========================
// SUELO AUXILIAR
// =========================
const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(250, 250),
    new THREE.MeshStandardMaterial({
        color: 0xd7dbe0,
        roughness: 1
    })
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.02;
ground.receiveShadow = true;
scene.add(ground);

// =========================
// PARÁMETROS GLOBALES
// =========================
const GRAVITY = 30;
const STEPS_PER_FRAME = 5;
const MAX_PLAYER_SPEED = 10.5;

// =========================
// PARÁMETROS AJUSTABLES
// =========================
const params = {
    exposure: 1.0,
    fogNear: 6,
    fogFar: 90,
    showOctree: false,
    cameraDistance: 4.8,
    cameraHeight: 1.45
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
const PLAYER_RADIUS = 0.34;
const PLAYER_HEIGHT = 1.75;

const playerCollider = new Capsule(
    new THREE.Vector3(0, PLAYER_RADIUS, 0),
    new THREE.Vector3(0, PLAYER_HEIGHT, 0),
    PLAYER_RADIUS
);

const playerVelocity = new THREE.Vector3();
let playerOnFloor = false;

// =========================
// PERSONAJE MIXAMO
// =========================
const fbxLoader = new FBXLoader();

let boxer = null;
let boxerMixer = null;
const boxerActions = {};
let activeAction = null;

let boxerOffsetY = 0;
const boxerTurnSpeed = 10;
const boxerVisualHeight = 1.45;
const boxerGroundAdjust = -0.10;

// =========================
// CONTROLES
// =========================
const keyStates = {};
let pointerLocked = false;

let yaw = 0;
let pitch = -0.12;

// =========================
// VECTORES AUXILIARES
// =========================
const vector1 = new THREE.Vector3();
const vector2 = new THREE.Vector3();
const vector3 = new THREE.Vector3();
const forwardVector = new THREE.Vector3();
const sideVector = new THREE.Vector3();
const headPosition = new THREE.Vector3();
const cameraTarget = new THREE.Vector3();
const desiredCameraPos = new THREE.Vector3();

const tempBox = new THREE.Box3();
const tempSize = new THREE.Vector3();
const tempCenter = new THREE.Vector3();

// =========================
// SCORE
// =========================
let score = 0;
const scoreElement = document.getElementById('score');

function updateScoreUI() {
    if (scoreElement) {
        scoreElement.textContent = `Score: ${score}`;
    }
}
updateScoreUI();

// =========================
// GUI
// =========================
const gui = new GUI({ width: 280 });
gui.title('Box Ring');

gui.add(params, 'exposure', 0.4, 2.0, 0.01).name('Exposición').onChange((v) => {
    renderer.toneMappingExposure = v;
});

gui.add(params, 'fogNear', 1, 30, 1).name('Niebla inicio').onChange((v) => {
    scene.fog.near = v;
});

gui.add(params, 'fogFar', 20, 160, 1).name('Niebla fin').onChange((v) => {
    scene.fog.far = v;
});

gui.add(params, 'cameraDistance', 2.5, 8.0, 0.1).name('Distancia cámara');
gui.add(params, 'cameraHeight', 0.6, 3.5, 0.1).name('Altura cámara');

gui.add(params, 'showOctree').name('Mostrar octree').onChange((value) => {
    if (octreeHelper) octreeHelper.visible = value;
});

// =========================
// EVENTOS
// =========================
document.addEventListener('keydown', (event) => {
    if ([
        'Space',
        'KeyW', 'KeyA', 'KeyS', 'KeyD',
        'KeyJ', 'KeyK', 'KeyB',
        'ShiftLeft'
    ].includes(event.code)) {
        event.preventDefault();
    }

    keyStates[event.code] = true;

    if (!worldReady) return;

    if (event.code === 'KeyJ') {
        playOneShot('jab');
    }

    if (event.code === 'KeyK') {
        playOneShot('hook');
    }

    if (event.code === 'KeyB') {
        playOneShot('block');
    }
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

    yaw -= event.movementX / 500;
    pitch -= event.movementY / 500;

    const limit = Math.PI / 2 - 0.15;
    pitch = Math.max(-limit, Math.min(limit, pitch));
});

// =========================
// DIRECCIÓN DE MOVIMIENTO
// =========================
function getForwardVector() {
    forwardVector.set(Math.sin(yaw), 0, Math.cos(yaw)).normalize();
    return forwardVector;
}

function getSideVector() {
    sideVector.set(Math.cos(yaw), 0, -Math.sin(yaw)).normalize();
    return sideVector;
}

// =========================
// ANIMACIONES
// =========================
function fadeToAction(name, duration = 0.2) {
    const nextAction = boxerActions[name];
    if (!nextAction || activeAction === nextAction) return;

    const previousAction = activeAction;
    activeAction = nextAction;

    if (previousAction) {
        previousAction.fadeOut(duration);
    }

    activeAction
        .reset()
        .setEffectiveTimeScale(1)
        .setEffectiveWeight(1)
        .fadeIn(duration)
        .play();
}

function playOneShot(name, fadeIn = 0.08, fadeOut = 0.18) {
    const action = boxerActions[name];
    if (!action || !boxerMixer) return;

    action.reset();
    action.enabled = true;
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.fadeIn(fadeIn);
    action.play();

    const onFinished = (e) => {
        if (e.action !== action) return;
        boxerMixer.removeEventListener('finished', onFinished);
        fadeToAction('Idle', fadeOut);

        if (name === 'jab') score += 10;
        if (name === 'hook') score += 15;
        if (name === 'block') score += 2;
        updateScoreUI();
    };

    boxerMixer.addEventListener('finished', onFinished);
}

function updateBoxerTransform(deltaTime) {
    if (!boxer) return;

    const centerX = (playerCollider.start.x + playerCollider.end.x) * 0.5;
    const centerY = playerCollider.start.y;
    const centerZ = (playerCollider.start.z + playerCollider.end.z) * 0.5;

    boxer.position.set(
        centerX,
        centerY + boxerOffsetY,
        centerZ
    );

    const moveX = playerVelocity.x;
    const moveZ = playerVelocity.z;
    const speedSq = moveX * moveX + moveZ * moveZ;

    if (speedSq > 0.0004) {
        const targetAngle = Math.atan2(moveX, moveZ);
        boxer.rotation.y = THREE.MathUtils.lerp(
            boxer.rotation.y,
            targetAngle,
            Math.min(1, boxerTurnSpeed * deltaTime)
        );
    } else {
        boxer.rotation.y = THREE.MathUtils.lerp(
            boxer.rotation.y,
            yaw,
            Math.min(1, 6 * deltaTime)
        );
    }
}

function updateAnimationState() {
    if (!boxerMixer) return;

    const horizontalSpeed = Math.sqrt(
        playerVelocity.x * playerVelocity.x +
        playerVelocity.z * playerVelocity.z
    );

    const busy =
        boxerActions.jab?.isRunning() ||
        boxerActions.hook?.isRunning() ||
        boxerActions.block?.isRunning();

    if (busy) return;

    if (!playerOnFloor) {
        fadeToAction('Idle', 0.12);
        return;
    }

    if (horizontalSpeed > 4.8 && boxerActions.run) {
        fadeToAction('run', 0.15);
    } else if (horizontalSpeed > 0.15 && boxerActions.walk) {
        fadeToAction('walk', 0.18);
    } else {
        fadeToAction('Idle', 0.2);
    }
}

// =========================
// CARGAR BOXEADOR
// =========================
async function loadBoxer() {
    const model = await fbxLoader.loadAsync('./models/fbx/character.fbx');

    model.traverse((child) => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
        }
    });

    const boxerBox = new THREE.Box3().setFromObject(model);
    const boxerSize = new THREE.Vector3();
    boxerBox.getSize(boxerSize);

    const scaleFactor = boxerVisualHeight / boxerSize.y;
    model.scale.setScalar(scaleFactor);
    model.updateMatrixWorld(true);

    boxerBox.setFromObject(model);
    boxerOffsetY = -boxerBox.min.y + boxerGroundAdjust;

    boxer = model;
    boxerMixer = new THREE.AnimationMixer(boxer);

    const idleFbx  = await fbxLoader.loadAsync('./models/fbx/Idle.fbx');
    const walkFbx  = await fbxLoader.loadAsync('./models/fbx/walk.fbx');
    const runFbx   = await fbxLoader.loadAsync('./models/fbx/run.fbx');
    const jabFbx   = await fbxLoader.loadAsync('./models/fbx/jab.fbx');
    const hookFbx  = await fbxLoader.loadAsync('./models/fbx/hook.fbx');
    const blockFbx = await fbxLoader.loadAsync('./models/fbx/block.fbx');

    boxerActions.Idle  = boxerMixer.clipAction(idleFbx.animations[0]);
    boxerActions.walk  = boxerMixer.clipAction(walkFbx.animations[0]);
    boxerActions.run   = boxerMixer.clipAction(runFbx.animations[0]);
    boxerActions.jab   = boxerMixer.clipAction(jabFbx.animations[0]);
    boxerActions.hook  = boxerMixer.clipAction(hookFbx.animations[0]);
    boxerActions.block = boxerMixer.clipAction(blockFbx.animations[0]);

    boxerActions.Idle.play();
    activeAction = boxerActions.Idle;

    scene.add(boxer);
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
// CONTROLES DE MOVIMIENTO
// =========================
function controls(deltaTime) {
    const running = keyStates['ShiftLeft'];
    const baseSpeed = running ? 19 : 12;
    const airSpeed = running ? 7 : 5;
    const speedDelta = deltaTime * (playerOnFloor ? baseSpeed : airSpeed);

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
        playerVelocity.y = 9.5;
    }
}

// =========================
// CÁMARA TERCERA PERSONA
// =========================
function updateThirdPersonCamera(deltaTime) {
    headPosition.copy(playerCollider.end);

    const camDirection = vector2.set(
        Math.sin(yaw) * Math.cos(pitch),
        Math.sin(pitch),
        Math.cos(yaw) * Math.cos(pitch)
    ).normalize();

    desiredCameraPos
        .copy(headPosition)
        .addScaledVector(camDirection, -params.cameraDistance);

    desiredCameraPos.y += params.cameraHeight;

    camera.position.lerp(desiredCameraPos, Math.min(1, 6 * deltaTime));

    cameraTarget.copy(headPosition);
    cameraTarget.y += 0.25;

    camera.lookAt(cameraTarget);
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

    const deltaPosition = vector3.copy(playerVelocity).multiplyScalar(deltaTime);
    playerCollider.translate(deltaPosition);

    playerCollisions();
    keepPlayerInsideBounds();
    updateThirdPersonCamera(deltaTime);
}

// =========================
// MANTENER JUGADOR DENTRO DEL RING
// =========================
function keepPlayerInsideBounds() {
    const margin = 0.75;

    const minX = worldInfo.center.x - worldInfo.halfWidth + margin;
    const maxX = worldInfo.center.x + worldInfo.halfWidth - margin;
    const minZ = worldInfo.center.z - worldInfo.halfDepth + margin;
    const maxZ = worldInfo.center.z + worldInfo.halfDepth - margin;

    const centerX = (playerCollider.start.x + playerCollider.end.x) * 0.5;
    const centerZ = (playerCollider.start.z + playerCollider.end.z) * 0.5;

    const clampedX = THREE.MathUtils.clamp(centerX, minX, maxX);
    const clampedZ = THREE.MathUtils.clamp(centerZ, minZ, maxZ);

    const dx = clampedX - centerX;
    const dz = clampedZ - centerZ;

    if (Math.abs(dx) > 1e-5 || Math.abs(dz) > 1e-5) {
        playerCollider.translate(new THREE.Vector3(dx, 0, dz));

        if (dx !== 0) playerVelocity.x = 0;
        if (dz !== 0) playerVelocity.z = 0;
    }
}

// =========================
// SPAWN DEL JUGADOR
// =========================
function setPlayerSpawn() {
    const spawnX = worldInfo.center.x;
    const spawnZ = worldInfo.center.z;
    const spawnY = worldInfo.floorY + 0.38;

    playerCollider.start.set(spawnX, spawnY, spawnZ);
    playerCollider.end.set(spawnX, spawnY + (PLAYER_HEIGHT - PLAYER_RADIUS), spawnZ);

    playerVelocity.set(0, 0, 0);
    yaw = 0;
    pitch = -0.12;

    updateThirdPersonCamera(1);
}

// =========================
// TELEPORT SI CAE
// =========================
function teleportPlayerIfOob() {
    if (camera.position.y < worldInfo.floorY - 10) {
        setPlayerSpawn();
    }
}

// =========================
// AJUSTAR MODELO AL RING
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

    worldInfo.halfWidth = Math.max(1.8, worldInfo.size.x * 0.18);
    worldInfo.halfDepth = Math.max(1.8, worldInfo.size.z * 0.18);

    const maxDim = Math.max(worldInfo.size.x, worldInfo.size.z, 10);

    scene.fog.far = Math.max(params.fogFar, maxDim * 4);

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
// CARGAR RING
// =========================
const gltfLoader = new GLTFLoader().setPath('./models/gltf/');

gltfLoader.load(
    'ring.glb',
    async (gltf) => {
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
                            if (mat.map) mat.map.anisotropy = 4;
                        });
                    } else {
                        child.material.side = THREE.FrontSide;
                        if (child.material.map) {
                            child.material.map.anisotropy = 4;
                        }
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

        try {
            await loadBoxer();
            updateBoxerTransform(0);
            fadeToAction('Idle', 0.01);
        } catch (error) {
            console.error('Error cargando boxeador FBX:', error);
        }

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

        const fullDelta = deltaTime * STEPS_PER_FRAME;

        updateBoxerTransform(fullDelta);
        updateAnimationState();

        if (boxerMixer) {
            boxerMixer.update(fullDelta);
        }
    }

    const t = performance.now() * 0.001;
    directionalLight.position.x = Math.sin(t * 0.2) * 10;
    directionalLight.position.z = Math.cos(t * 0.2) * 10;

    renderer.render(scene, camera);
    stats.update();
}