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
scene.fog = new THREE.Fog(0xcfd6dd, 6, 95);

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
// HUD AUTOMÁTICO
// =========================
function ensureHudElement(id, text, top, left) {
    let el = document.getElementById(id);
    if (!el) {
        el = document.createElement('div');
        el.id = id;
        el.textContent = text;
        el.style.position = 'fixed';
        el.style.top = `${top}px`;
        el.style.left = `${left}px`;
        el.style.zIndex = '1200';
        el.style.padding = '10px 14px';
        el.style.borderRadius = '14px';
        el.style.background = 'rgba(18,18,24,0.82)';
        el.style.border = '2px solid rgba(255,215,90,0.75)';
        el.style.color = '#fff';
        el.style.fontFamily = 'Arial, sans-serif';
        el.style.fontWeight = '700';
        el.style.backdropFilter = 'blur(6px)';
        el.style.boxShadow = '0 8px 22px rgba(0,0,0,0.28)';
        document.body.appendChild(el);
    }
    return el;
}

const scoreElement = ensureHudElement('score', 'Score: 0', 86, 18);
const timeElement = ensureHudElement('time', 'Tiempo: 60', 138, 18);
const comboElement = ensureHudElement('combo', 'Combo: x0', 190, 18);
const healthElement = ensureHudElement('health', 'Vida: 100', 242, 18);

let messageElement = document.getElementById('message');
if (!messageElement) {
    messageElement = document.createElement('div');
    messageElement.id = 'message';
    messageElement.style.position = 'fixed';
    messageElement.style.left = '50%';
    messageElement.style.top = '50%';
    messageElement.style.transform = 'translate(-50%, -50%)';
    messageElement.style.zIndex = '1300';
    messageElement.style.padding = '18px 24px';
    messageElement.style.borderRadius = '18px';
    messageElement.style.background = 'rgba(12,12,18,0.88)';
    messageElement.style.border = '2px solid rgba(255,215,90,0.85)';
    messageElement.style.color = '#fff';
    messageElement.style.fontFamily = 'Arial, sans-serif';
    messageElement.style.fontSize = '28px';
    messageElement.style.fontWeight = '800';
    messageElement.style.display = 'none';
    messageElement.style.textAlign = 'center';
    messageElement.style.whiteSpace = 'pre-line';
    document.body.appendChild(messageElement);
}

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
const ROUND_DURATION = 60;

// =========================
// PARÁMETROS AJUSTABLES
// =========================
const params = {
    exposure: 1.0,
    fogNear: 6,
    fogFar: 95,
    showOctree: false,
    cameraDistance: 4.8,
    cameraHeight: 1.45,
    bagScale: 0.9
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
const gltfLoader = new GLTFLoader().setPath('./models/gltf/');

let boxer = null;
let boxerMixer = null;
const boxerActions = {};
let activeAction = null;

let boxerOffsetY = 0;
const boxerTurnSpeed = 10;
const boxerVisualHeight = 1.45;
const boxerGroundAdjust = -0.35;

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
const vector4 = new THREE.Vector3();
const forwardVector = new THREE.Vector3();
const sideVector = new THREE.Vector3();
const headPosition = new THREE.Vector3();
const cameraTarget = new THREE.Vector3();
const desiredCameraPos = new THREE.Vector3();

const tempBox = new THREE.Box3();
const tempSize = new THREE.Vector3();
const tempCenter = new THREE.Vector3();

// =========================
// JUEGO
// =========================
let score = 0;
let combo = 0;
let health = 100;
let timeLeft = ROUND_DURATION;
let roundEnded = false;
let comboTimer = 0;

let attackState = null;
const ATTACK_CONFIG = {
    jab:  { duration: 0.34, activeStart: 0.10, activeEnd: 0.22, range: 1.5, radius: 0.9, score: 20, impulse: 5.5 },
    hook: { duration: 0.46, activeStart: 0.14, activeEnd: 0.30, range: 1.7, radius: 1.15, score: 30, impulse: 7.5 }
};

// =========================
// OBJETOS DE ENTRENAMIENTO
// =========================
const targetObjects = [];
const targetGroup = new THREE.Group();
const bagGroup = new THREE.Group();

scene.add(targetGroup);
scene.add(bagGroup);

let nextTargetId = 1;

// =========================
// UI
// =========================
function updateHud() {
    scoreElement.textContent = `Score: ${score}`;
    timeElement.textContent = `Tiempo: ${Math.max(0, Math.ceil(timeLeft))}`;
    comboElement.textContent = `Combo: x${combo}`;
    healthElement.textContent = `Vida: ${Math.max(0, Math.ceil(health))}`;
}

function showMessage(text) {
    messageElement.textContent = text;
    messageElement.style.display = 'block';
}

function hideMessage() {
    messageElement.style.display = 'none';
}

updateHud();

// =========================
// GUI
// =========================
const gui = new GUI({ width: 280 });
gui.title('Box Ring');

gui.add(params, 'exposure', 0.4, 2.0, 0.01).name('Exposición').onChange((v) => {
    renderer.toneMappingExposure = v;
});

gui.add(directionalLight, 'intensity', 0, 5, 0.1).name('Luz Principal');
gui.add(hemiLight, 'intensity', 0, 3, 0.1).name('Luz Ambiental');

gui.add(params, 'fogNear', 1, 30, 1).name('Niebla inicio').onChange((v) => {
    scene.fog.near = v;
});

gui.add(params, 'fogFar', 20, 160, 1).name('Niebla fin').onChange((v) => {
    scene.fog.far = v;
});

gui.add(params, 'cameraDistance', 2.5, 8.0, 0.1).name('Distancia cámara');
gui.add(params, 'cameraHeight', 0.6, 3.5, 0.1).name('Altura cámara');
gui.add(params, 'bagScale', 0.3, 2.0, 0.05).name('Escala costal');

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
        'ShiftLeft',
        'ArrowUp', 'ArrowDown'
    ].includes(event.code)) {
        event.preventDefault();
    }

    keyStates[event.code] = true;

    // Control de cámara por teclado (Zoom)
    if (event.code === 'ArrowUp') {
        params.cameraDistance = Math.max(1.5, params.cameraDistance - 0.5);
        gui.controllersRecursive().forEach(c => c.updateDisplay());
    }
    if (event.code === 'ArrowDown') {
        params.cameraDistance = Math.min(8.0, params.cameraDistance + 0.5);
        gui.controllersRecursive().forEach(c => c.updateDisplay());
    }

    // Reiniciar partida
    if (event.code === 'KeyR' && roundEnded) {
        score = 0;
        combo = 0;
        health = 100;
        timeLeft = ROUND_DURATION;
        roundEnded = false;
        
        setPlayerSpawn();
        targetObjects.forEach(t => { t.health = 200; t.tilt = 0; t.tiltVelocity = 0; });
        
        hideMessage();
        updateHud();
        return;
    }

    if (!worldReady || roundEnded) return;

    if (event.code === 'KeyJ') {
        startAttack('jab');
    }

    if (event.code === 'KeyK') {
        startAttack('hook');
    }

    if (event.code === 'KeyB') {
        playOneShot('block');
    }
});

document.addEventListener('keyup', (event) => {
    keyStates[event.code] = false;
});

container.addEventListener('click', () => {
    if (!roundEnded) {
        container.requestPointerLock();
    }
});

document.addEventListener('pointerlockchange', () => {
    pointerLocked = document.pointerLockElement === container;
});

document.addEventListener('mousemove', (event) => {
    if (!pointerLocked || !worldReady || roundEnded) return;

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

    if (previousAction) previousAction.fadeOut(duration);

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
        if (!attackState) fadeToAction('Idle', fadeOut);
    };

    boxerMixer.addEventListener('finished', onFinished);
}

function updateBoxerTransform(deltaTime) {
    if (!boxer) return;

    const centerX = (playerCollider.start.x + playerCollider.end.x) * 0.5;
    const centerY = playerCollider.start.y;
    const centerZ = (playerCollider.start.z + playerCollider.end.z) * 0.5;

    boxer.position.set(centerX, centerY + boxerOffsetY, centerZ);

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
        // Mejorada la fluidez de giro del personaje (de 6 a 12)
        boxer.rotation.y = THREE.MathUtils.lerp(
            boxer.rotation.y,
            yaw,
            Math.min(1, 12 * deltaTime)
        );
    }
}

function updateAnimationState() {
    if (!boxerMixer) return;
    if (attackState) return;

    const horizontalSpeed = Math.sqrt(
        playerVelocity.x * playerVelocity.x +
        playerVelocity.z * playerVelocity.z
    );

    if (boxerActions.block?.isRunning()) return;

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
// ATAQUES
// =========================
function startAttack(name) {
    if (attackState || !ATTACK_CONFIG[name]) return;

    attackState = {
        name,
        timer: 0,
        duration: ATTACK_CONFIG[name].duration,
        activeStart: ATTACK_CONFIG[name].activeStart,
        activeEnd: ATTACK_CONFIG[name].activeEnd,
        hitTargets: new Set()
    };

    playOneShot(name, 0.06, 0.12);
}

function updateAttack(deltaTime) {
    if (!attackState || roundEnded) return;

    attackState.timer += deltaTime;

    const cfg = ATTACK_CONFIG[attackState.name];

    if (attackState.timer >= attackState.activeStart && attackState.timer <= attackState.activeEnd) {
        processAttackHits(cfg, attackState.hitTargets);
    }

    if (attackState.timer >= attackState.duration) {
        attackState = null;
    }
}

function processAttackHits(cfg, hitTargets) {
    const playerCenter = vector1.set(
        (playerCollider.start.x + playerCollider.end.x) * 0.5,
        playerCollider.start.y + 0.9,
        (playerCollider.start.z + playerCollider.end.z) * 0.5
    );

    const attackForward = vector2.set(Math.sin(yaw), 0, Math.cos(yaw)).normalize();
    const attackPoint = vector3.copy(playerCenter).addScaledVector(attackForward, cfg.range * 0.7);

    for (const target of targetObjects) {
        if (hitTargets.has(target.id)) continue;

        // Vector hacia el objetivo
        const toTarget = vector4.copy(target.position).sub(playerCenter);
        
        // ¡LA CLAVE ESTÁ AQUÍ! Ignoramos la diferencia de altura
        toTarget.y = 0; 
        const dist = toTarget.length();
        
        if (dist > cfg.range + cfg.radius) continue;

        if (dist > 0.0001) {
            toTarget.normalize();
            const dot = toTarget.dot(attackForward);
            if (dot < 0.15) continue; // Ángulo de visión
        }

        /// Medir distancia del impacto al cuadrado
        const dx = target.position.x - attackPoint.x;
        const dz = target.position.z - attackPoint.z;
        const hitDistSq = (dx * dx) + (dz * dz);
        
        const strikeRadius = cfg.radius + target.radius;

      // Comparamos sin usar raíz cuadrada
        if (hitDistSq <= (strikeRadius * strikeRadius)) {
            hitTargets.add(target.id);

            target.hitFlash = 0.16;
            target.tiltVelocity += cfg.impulse * 0.06;
            target.health -= (cfg.score * 0.35);

            combo += 1;
            comboTimer = 2.3;
            score += cfg.score + Math.max(0, combo - 1) * 5;

            if (target.health <= 0) {
                target.health = 200;
                score += 80;
                combo += 1;
                comboTimer = 2.8;
            }

            updateHud();
        }
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
// COSTAL GLB
// =========================
async function createPunchingBag(x, z) {
    return new Promise((resolve, reject) => {
        gltfLoader.load(
            'poly.glb',
            (gltf) => {
                const bag = gltf.scene;

                bag.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                });

                bag.scale.setScalar(params.bagScale);
                bag.updateMatrixWorld(true);

                const box = new THREE.Box3().setFromObject(bag);
                const size = new THREE.Vector3();
                const center = new THREE.Vector3();
                box.getSize(size);
                box.getCenter(center);

                bag.position.x -= center.x;
                bag.position.z -= center.z;
                bag.position.y -= box.min.y;
                bag.updateMatrixWorld(true);

                const pivot = new THREE.Group();
                pivot.position.set(x, worldInfo.floorY, z);
                pivot.add(bag);

                bagGroup.add(pivot);

                // Aumentamos ligeramente el radio para detectar mejor la colisión del jugador
                const radius = Math.max(0.45, Math.max(size.x, size.z) * 0.45);

                const target = {
                    id: nextTargetId++,
                    type: 'bag',
                    group: pivot,
                    mesh: bag,
                    position: pivot.position,
                    radius,
                    health: 200,
                    tilt: 0,
                    tiltVelocity: 0,
                    hitFlash: 0
                };

                targetObjects.push(target);
                resolve(target);
            },
            undefined,
            (error) => reject(error)
        );
    });
}

async function createBags() {
    while (bagGroup.children.length > 0) {
        bagGroup.remove(bagGroup.children[0]);
    }

    for (let i = targetObjects.length - 1; i >= 0; i--) {
        if (targetObjects[i].type === 'bag') {
            targetObjects.splice(i, 1);
        }
    }

    const z = -worldInfo.halfDepth * 0.15;
    const x = 0;

    await createPunchingBag(x, z);
}

function updateTargets(deltaTime) {
    for (const target of targetObjects) {
        target.tiltVelocity += (-target.tilt * 9.5) * deltaTime;
        target.tiltVelocity *= Math.exp(-5.5 * deltaTime);
        target.tilt += target.tiltVelocity * deltaTime;
        target.tilt = THREE.MathUtils.clamp(target.tilt, -0.45, 0.45);

        target.group.rotation.z = target.tilt;

        if (target.hitFlash > 0) {
            target.hitFlash -= deltaTime;
        }
    }
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
    if (roundEnded) return;

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

    // Mejorada la fluidez de seguimiento de la cámara (de 6 a 12)
    camera.position.lerp(desiredCameraPos, Math.min(1, 12 * deltaTime));

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

 // --- COLISIÓN MATEMÁTICA CON EL COSTAL (OPTIMIZADA) ---
    const px = (playerCollider.start.x + playerCollider.end.x) * 0.5;
    const pz = (playerCollider.start.z + playerCollider.end.z) * 0.5;

    for (const target of targetObjects) {
        const dx = px - target.position.x;
        const dz = pz - target.position.z;
        
        // Calculamos la distancia al cuadrado (sin raíz)
        const distSq = (dx * dx) + (dz * dz);
        const minDist = target.radius + PLAYER_RADIUS + 0.15; 
        
        // Comparamos contra la distancia mínima al cuadrado
        if (distSq < (minDist * minDist) && distSq > 0.0001) {
            // SOLO calculamos la raíz cuadrada si ya confirmamos que chocaron
            const dist = Math.sqrt(distSq); 
            const overlap = minDist - dist;
            const pushX = (dx / dist) * overlap;
            const pushZ = (dz / dist) * overlap;
            
            playerCollider.translate(new THREE.Vector3(pushX, 0, pushZ));
        }
    }
    // -------------------------------------------------------------
 

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
    const spawnZ = worldInfo.center.z + worldInfo.halfDepth * 0.35;
    const spawnY = worldInfo.floorY + 0.38;

    playerCollider.start.set(spawnX, spawnY, spawnZ);
    playerCollider.end.set(spawnX, spawnY + (PLAYER_HEIGHT - PLAYER_RADIUS), spawnZ);

    playerVelocity.set(0, 0, 0);
    yaw = Math.PI;
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
}

// =========================
// RONDA
// =========================
function endRound() {
    roundEnded = true;
    pointerLocked = false;
    document.exitPointerLock();

    const result = score >= 250 ? '¡Victoria!' : 'Fin del round';
    showMessage(`${result}\nScore final: ${score}\n\nPresiona 'R' para reiniciar`);
}

function updateGameState(deltaTime) {
    if (roundEnded) return;

    timeLeft -= deltaTime;
    if (timeLeft <= 0) {
        timeLeft = 0;
        endRound();
    }

    if (comboTimer > 0) {
        comboTimer -= deltaTime;
        if (comboTimer <= 0) combo = 0;
    }

    health = Math.max(0, health);
    updateHud();
}

// =========================
// CARGAR RING
// =========================
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
                        if (child.material.map) child.material.map.anisotropy = 4;
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
            octreeHelper = null;
        }

        setPlayerSpawn();

        try {
            await createBags();
        } catch (error) {
            console.error('Error cargando poly.glb:', error);
        }

        try {
            await loadBoxer();
            updateBoxerTransform(0);
            fadeToAction('Idle', 0.01);
        } catch (error) {
            console.error('Error cargando boxeador FBX:', error);
        }

        worldReady = true;
        hideMessage();
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

        updateAttack(fullDelta);
        updateBoxerTransform(fullDelta);
        updateAnimationState();
        updateTargets(fullDelta);
        updateGameState(fullDelta);

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