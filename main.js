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
// CONFIGURACIÓN MAESTRA DEL JUEGO
// =========================
const GAME_CONFIG = {
    physics: {
        gravity: 30,
        maxSpeed: 15.5,
        stepsPerFrame: 5
    },
    movement: {
        walkSpeed: 8.5,
        runSpeed: 13.5,
        airWalkSpeed: 4.5,
        airRunSpeed: 6.5,
        jumpForce: 9.5,
        turnSpeed: 12
    },
    camera: {
        followSpeed: 12,
        collisionRadius: 0.22
    },
    round: {
        duration: 60
    }
};

const STEPS_PER_FRAME = GAME_CONFIG.physics.stepsPerFrame;

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
const staminaElement = ensureHudElement('stamina', 'Estamina: 100%', 242, 18);

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
const boxerVisualHeight = 1.45;
const boxerGroundAdjust = -0.35;

let isVictorious = false;

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
const vector5 = new THREE.Vector3();
const vector6 = new THREE.Vector3();

const forwardVector = new THREE.Vector3();
const sideVector = new THREE.Vector3();
const headPosition = new THREE.Vector3();
const cameraTarget = new THREE.Vector3();
const desiredCameraPos = new THREE.Vector3();
const resolvedCameraPos = new THREE.Vector3();

const tempBox = new THREE.Box3();
const tempSize = new THREE.Vector3();
const tempCenter = new THREE.Vector3();

// =========================
// JUEGO Y COMBATE (ESTAMINA)
// =========================
let score = 0;
let combo = 0;
let stamina = 100;
let isTired = false;
let timeLeft = GAME_CONFIG.round.duration;
let roundEnded = false;
let comboTimer = 0;

let attackState = null;

const ATTACK_CONFIG = {
    jab:      { name: 'jab',      duration: 0.90, activeStart: 0.20, activeEnd: 0.40, range: 0.75, radius: 0.35, score: 20, impulse: 5.5, speed: 1.0, staminaCost: 8 },
    hook:     { name: 'hook',     duration: 1.20, activeStart: 0.35, activeEnd: 0.55, range: 0.70, radius: 0.45, score: 30, impulse: 9.5, speed: 0.95, staminaCost: 15 },
    uppercut: { name: 'uppercut', duration: 1.40, activeStart: 0.40, activeEnd: 0.65, range: 0.65, radius: 0.40, score: 40, impulse: 14.0, speed: 0.9, staminaCost: 25 },
    punching: { name: 'punching', duration: 1.30, activeStart: 0.25, activeEnd: 0.60, range: 1.20, radius: 0.45, score: 25, impulse: 8.5, speed: 0.85, staminaCost: 18 }
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
// EFECTOS VISUALES Y CÁMARA
// =========================
const currentShake = {
    intensity: 0,
    duration: 0,
    offset: new THREE.Vector3()
};

let hitParticles = null;

function triggerCameraShake(intensity, duration) {
    currentShake.intensity = Math.max(currentShake.intensity, intensity);
    currentShake.duration = Math.max(currentShake.duration, duration);
}

// =========================
// UI
// =========================
function updateHud() {
    scoreElement.textContent = `Score: ${score}`;
    timeElement.textContent = `Tiempo: ${Math.max(0, Math.ceil(timeLeft))}`;
    comboElement.textContent = `Combo: x${combo}`;

    if (isTired) {
        staminaElement.style.color = '#ff4444';
        staminaElement.textContent = `¡AGOTADO! Levanta guardia (${Math.max(0, Math.ceil(stamina))}%)`;
    } else {
        staminaElement.style.color = '#fff';
        staminaElement.textContent = `Estamina: ${Math.max(0, Math.ceil(stamina))}%`;
    }
}

function showMessage(text) {
    messageElement.textContent = text;
    messageElement.style.display = 'block';
}

function hideMessage() {
    messageElement.style.display = 'none';
}

// =========================
// GUI
// =========================
const gui = new GUI({ width: 280 });
gui.title('Box Ring');
gui.add(params, 'exposure', 0.4, 2.0, 0.01).name('Exposición').onChange((v) => renderer.toneMappingExposure = v);
gui.add(directionalLight, 'intensity', 0, 5, 0.1).name('Luz Principal');
gui.add(hemiLight, 'intensity', 0, 3, 0.1).name('Luz Ambiental');
gui.add(params, 'fogNear', 1, 30, 1).name('Niebla inicio').onChange((v) => scene.fog.near = v);
gui.add(params, 'fogFar', 20, 160, 1).name('Niebla fin').onChange((v) => scene.fog.far = v);
gui.add(params, 'cameraDistance', 2.5, 8.0, 0.1).name('Distancia cámara');
gui.add(params, 'cameraHeight', 0.6, 3.5, 0.1).name('Altura cámara');
gui.add(params, 'bagScale', 0.3, 2.0, 0.05).name('Escala costal');
gui.add(params, 'showOctree').name('Mostrar octree').onChange((value) => {
    if (octreeHelper) octreeHelper.visible = value;
});

// =========================
// EVENTOS DE TECLADO Y MOUSE
// =========================
document.addEventListener('keydown', (event) => {
    if ([
        'Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD',
        'KeyQ', 'KeyE', 'KeyF', 'ShiftLeft',
        'ArrowUp', 'ArrowDown', 'KeyR'
    ].includes(event.code)) {
        event.preventDefault();
    }

    if (event.repeat) return;

    keyStates[event.code] = true;

    if (event.code === 'ArrowUp') {
        params.cameraDistance = Math.max(1.5, params.cameraDistance - 0.5);
        gui.controllersRecursive().forEach(c => c.updateDisplay());
    }

    if (event.code === 'ArrowDown') {
        params.cameraDistance = Math.min(8.0, params.cameraDistance + 0.5);
        gui.controllersRecursive().forEach(c => c.updateDisplay());
    }

    if (event.code === 'KeyR' && roundEnded) {
        score = 0;
        combo = 0;
        stamina = 100;
        isTired = false;
        timeLeft = GAME_CONFIG.round.duration;
        roundEnded = false;
        isVictorious = false;
        attackState = null;

        setPlayerSpawn();

        targetObjects.forEach(t => {
            t.health = 200;
            t.swing.set(0, 0);
            t.swingVelocity.set(0, 0);
            t.hitFlash = 0;
        });

        hideMessage();
        updateHud();
        fadeToAction('Idle', 0.2);
        return;
    }

    if (!worldReady || roundEnded || isTired) return;
    if (keyStates['Space'] || boxerActions.reaction?.isRunning() || boxerActions.dodging?.isRunning()) return;

    if (event.code === 'KeyF') startAttack('hook');
    if (event.code === 'KeyQ') startAttack('uppercut');
    if (event.code === 'KeyE') triggerDodge();
});

document.addEventListener('keyup', (event) => {
    keyStates[event.code] = false;
});

document.addEventListener('mousedown', (event) => {
    if (!pointerLocked || !worldReady || roundEnded || isTired) return;
    if (keyStates['Space'] || boxerActions.reaction?.isRunning() || boxerActions.dodging?.isRunning()) return;

    if (event.button === 0) {
        startAttack('jab');
    } else if (event.button === 2) {
        startAttack('punching');
    }
});

document.addEventListener('contextmenu', (event) => event.preventDefault());

container.addEventListener('click', () => {
    if (!roundEnded) container.requestPointerLock();
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

function getForwardVector() {
    forwardVector.set(Math.sin(yaw), 0, Math.cos(yaw)).normalize();
    return forwardVector;
}

function getSideVector() {
    sideVector.set(Math.cos(yaw), 0, -Math.sin(yaw)).normalize();
    return sideVector;
}

// =========================
// ANIMACIONES Y ESTADOS
// =========================
function fadeToAction(name, duration = 0.2) {
    const nextAction = boxerActions[name];
    if (!nextAction || activeAction === nextAction) return;

    const previousAction = activeAction;
    activeAction = nextAction;

    if (previousAction) previousAction.fadeOut(duration);

    activeAction
        .reset()
        .setEffectiveTimeScale(1.0)
        .setEffectiveWeight(1)
        .fadeIn(duration)
        .play();
}

function playOneShot(name, fadeIn = 0.08, fadeOut = 0.2, speed = 1.0) {
    const action = boxerActions[name];
    if (!action || !boxerMixer) return;

    action.reset();
    action.enabled = true;
    action.setEffectiveTimeScale(speed);
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.fadeIn(fadeIn);
    action.play();

    const onFinished = (e) => {
        if (e.action !== action) return;
        boxerMixer.removeEventListener('finished', onFinished);
        if (!attackState && !isVictorious && !isTired) fadeToAction('Idle', fadeOut);
    };

    boxerMixer.addEventListener('finished', onFinished);
}

function updateBoxerTransform(deltaTime) {
    if (!boxer) return;

    const centerX = (playerCollider.start.x + playerCollider.end.x) * 0.5;
    const centerY = playerCollider.start.y;
    const centerZ = (playerCollider.start.z + playerCollider.end.z) * 0.5;

    boxer.position.set(centerX, centerY + boxerOffsetY, centerZ);

    boxer.rotation.y = THREE.MathUtils.lerp(
        boxer.rotation.y,
        yaw,
        Math.min(1, GAME_CONFIG.movement.turnSpeed * deltaTime * 1.5)
    );
}

function updateAnimationState() {
    if (!boxerMixer) return;

    if (boxerActions.reaction?.isRunning() || boxerActions.dodging?.isRunning() || isVictorious) return;

    if (isTired) {
        if (attackState) attackState = null;

        if (boxerActions.block) {
            boxerActions.block.setEffectiveTimeScale(0.7);
        }

        fadeToAction('block', 0.3);
        return;
    }

    if (boxerActions.block) {
        boxerActions.block.setEffectiveTimeScale(1.0);
    }

    if (attackState) return;

    if (keyStates['Space'] && playerOnFloor) {
        fadeToAction('block', 0.15);
        return;
    }

    const horizontalSpeed = Math.sqrt(playerVelocity.x * playerVelocity.x + playerVelocity.z * playerVelocity.z);

    if (!playerOnFloor) {
        fadeToAction('Idle', 0.15);
        return;
    }

    if (horizontalSpeed > 6.2 && keyStates['ShiftLeft']) {
        fadeToAction('run', 0.15);
    } else if (horizontalSpeed > 0.18) {
        fadeToAction('walk', 0.15);
    } else {
        fadeToAction('Idle', 0.2);
    }
}

// =========================
// ACCIONES DEFENSIVAS
// =========================
function triggerDodge() {
    if (!playerOnFloor || stamina < 5) return;

    stamina -= 5;
    if (stamina < 0) stamina = 0;

    updateHud();
    playOneShot('dodging', 0.10, 0.25, 0.85);
}

function triggerBagHit() {
    if (isVictorious || roundEnded || isTired) return;

    attackState = null;
    playOneShot('reaction', 0.05, 0.2, 1.1);

    combo = 0;
    comboTimer = 0;
    stamina -= 20;

    if (stamina <= 0) {
        stamina = 0;
        isTired = true;
    }

    updateHud();
    triggerCameraShake(0.12, 0.3);
}

// =========================
// ATAQUES Y COLISIONES
// =========================
function startAttack(name) {
    if (attackState || isTired || !ATTACK_CONFIG[name]) return;
    const cfg = ATTACK_CONFIG[name];

    if (stamina < cfg.staminaCost) {
        stamina = 0;
        isTired = true;
        updateHud();
        return;
    }

    stamina -= cfg.staminaCost;
    updateHud();

    attackState = {
        name: cfg.name,
        timer: 0,
        duration: cfg.duration,
        activeStart: cfg.activeStart,
        activeEnd: cfg.activeEnd,
        hitTargets: new Set()
    };

    playOneShot(name, 0.05, 0.2, cfg.speed);
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

        const toTarget = vector4.copy(target.position).sub(playerCenter);
        toTarget.y = 0;
        const dist = toTarget.length();

        if (dist > cfg.range + cfg.radius) continue;

        if (dist > 0.0001) {
            toTarget.normalize();
            if (toTarget.dot(attackForward) < 0.15) continue;
        }

        const hitDistSq =
            Math.pow(target.position.x - attackPoint.x, 2) +
            Math.pow(target.position.z - attackPoint.z, 2);

        const strikeRadius = cfg.radius + target.radius;

        if (hitDistSq <= (strikeRadius * strikeRadius)) {
            hitTargets.add(target.id);
            target.hitFlash = 0.16;

            target.swingVelocity.x += attackForward.x * cfg.impulse * 0.12;
            target.swingVelocity.y += attackForward.z * cfg.impulse * 0.12;

            target.health -= (cfg.score * 0.35);

            combo += 1;
            comboTimer = 2.3;
            score += cfg.score + Math.max(0, combo - 1) * 5;

            stamina = Math.min(100, stamina + 2);

            if (target.health <= 0) {
                target.health = 200;
                score += 80;
                combo += 1;
                comboTimer = 2.8;
            }

            updateHud();

            const vectorToBagSurface = toTarget.clone().normalize();
            const exactImpactPoint = target.position.clone().sub(
                vectorToBagSurface.multiplyScalar(target.radius)
            );

            exactImpactPoint.y = Math.min(
                playerCollider.end.y - 0.2,
                target.position.y + target.bagHeight / 2
            );

            if (hitParticles) {
                const reflectDir = attackForward
                    .clone()
                    .reflect(toTarget.clone().normalize())
                    .negate()
                    .add(new THREE.Vector3(0, 0.45, 0));

                hitParticles.emit(exactImpactPoint, reflectDir, Math.max(6, Math.floor(cfg.score / 4)));
            }

            let shakeInt = 0;
            if (cfg.name === 'jab') shakeInt = 0.05;
            if (cfg.name === 'hook' || cfg.name === 'punching') shakeInt = 0.15;
            if (cfg.name === 'uppercut') shakeInt = 0.25;

            triggerCameraShake(shakeInt, 0.3);
        }
    }
}

// =========================
// CARGAR BOXEADOR Y ANIMACIONES
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

    const animFiles = {
        Idle: './models/fbx/Idle.fbx',
        walk: './models/fbx/walk.fbx',
        run: './models/fbx/run.fbx',
        jab: './models/fbx/jab.fbx',
        hook: './models/fbx/hook.fbx',
        block: './models/fbx/block.fbx',
        uppercut: './models/fbx/Uppercut.fbx',
        punching: './models/fbx/Punching.fbx',
        dodging: './models/fbx/Dodging.fbx',
        reaction: './models/fbx/Reaction.fbx',
        victory: './models/fbx/Victory.fbx'
    };

    const entries = Object.entries(animFiles);

    const loadedAnimations = await Promise.all(
        entries.map(async ([name, path]) => {
            try {
                const fbx = await fbxLoader.loadAsync(path);
                if (!fbx.animations || !fbx.animations[0]) {
                    console.warn(`Animación inválida o vacía: ${name} -> ${path}`);
                    return [name, null];
                }
                return [name, fbx.animations[0]];
            } catch (err) {
                console.warn(`No se pudo cargar la animación "${name}" desde ${path}`, err);
                return [name, null];
            }
        })
    );

    for (const [name, clip] of loadedAnimations) {
        if (!clip) continue;
        boxerActions[name] = boxerMixer.clipAction(clip);
    }

    if (!boxerActions.Idle) {
        throw new Error('No se pudo cargar Idle.fbx. Esa animación es obligatoria.');
    }

    boxerActions.Idle.play();
    activeAction = boxerActions.Idle;

    scene.add(boxer);
}

// =========================
// COSTAL: FÍSICA DE PÉNDULO 3D
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
                bag.position.y -= box.max.y;
                bag.updateMatrixWorld(true);

                const pivot = new THREE.Group();
                pivot.position.set(x, worldInfo.floorY + size.y + 1, z);
                pivot.add(bag);

                bagGroup.add(pivot);

                const radius = Math.max(0.45, Math.max(size.x, size.z) * 0.45);

                const target = {
                    id: nextTargetId++,
                    type: 'bag',
                    group: pivot,
                    mesh: bag,
                    pivot,
                    position: new THREE.Vector3().copy(pivot.position),
                    bagHeight: size.y,
                    radius,
                    health: 200,
                    hitFlash: 0,
                    swing: new THREE.Vector2(0, 0),
                    swingVelocity: new THREE.Vector2(0, 0)
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
    while (bagGroup.children.length > 0) bagGroup.remove(bagGroup.children[0]);

    for (let i = targetObjects.length - 1; i >= 0; i--) {
        if (targetObjects[i].type === 'bag') targetObjects.splice(i, 1);
    }

    await createPunchingBag(0, -worldInfo.halfDepth * 0.15);
}

function updateTargets(deltaTime) {
    const playerCenter = vector1.set(
        (playerCollider.start.x + playerCollider.end.x) * 0.5,
        playerCollider.start.y + 0.9,
        (playerCollider.start.z + playerCollider.end.z) * 0.5
    );

    const tempLocalCenter = new THREE.Vector3();
    const tempWorldCenter = new THREE.Vector3();

    for (const target of targetObjects) {
        if (target.type === 'bag') {
            target.swingVelocity.x += (-target.swing.x * 20.0) * deltaTime;
            target.swingVelocity.y += (-target.swing.y * 20.0) * deltaTime;

            target.swingVelocity.multiplyScalar(Math.exp(-3.5 * deltaTime));

            target.swing.x += target.swingVelocity.x * deltaTime;
            target.swing.y += target.swingVelocity.y * deltaTime;

            const swingMag = target.swing.length();
            if (swingMag > 0.8) target.swing.multiplyScalar(0.8 / swingMag);

            target.pivot.rotation.x = target.swing.y;
            target.pivot.rotation.z = -target.swing.x;

            target.pivot.updateMatrixWorld(true);

            tempLocalCenter.set(0, -target.bagHeight * 0.5, 0);
            tempWorldCenter.copy(tempLocalCenter).applyMatrix4(target.pivot.matrixWorld);
            target.position.copy(tempWorldCenter);

            const speedSq = target.swingVelocity.lengthSq();
            if (speedSq > 0.5) {
                const dx = playerCenter.x - target.position.x;
                const dz = playerCenter.z - target.position.z;
                const distSq = (dx * dx) + (dz * dz);

                const hitRadius = target.radius + PLAYER_RADIUS + 0.2;

                if (distSq < (hitRadius * hitRadius)) {
                    const dotProduct = (dx * target.swingVelocity.x) + (dz * target.swingVelocity.y);

                    if (
                        dotProduct > 0.1 &&
                        !keyStates['Space'] &&
                        !boxerActions.dodging?.isRunning() &&
                        !boxerActions.reaction?.isRunning()
                    ) {
                        triggerBagHit();
                        target.swingVelocity.multiplyScalar(-0.2);
                    }
                }
            }
        }

        if (target.hitFlash > 0) target.hitFlash -= deltaTime;
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

function controls(deltaTime) {
    if (roundEnded || isVictorious || boxerActions.reaction?.isRunning() || boxerActions.dodging?.isRunning()) return;

    const isBlocking = keyStates['Space'];
    const running = keyStates['ShiftLeft'] && !isBlocking && !isTired;

    let baseSpeed = running
        ? GAME_CONFIG.movement.runSpeed
        : (isBlocking ? 3.8 : GAME_CONFIG.movement.walkSpeed);

    if (attackState) {
        baseSpeed *= 0.05;
    } else if (isTired) {
        baseSpeed *= 0.3;
    }

    const airSpeed = running ? GAME_CONFIG.movement.airRunSpeed : GAME_CONFIG.movement.airWalkSpeed;
    const speedDelta = deltaTime * (playerOnFloor ? baseSpeed : airSpeed);

    if (keyStates['KeyW']) playerVelocity.add(getForwardVector().multiplyScalar(speedDelta));
    if (keyStates['KeyS']) playerVelocity.add(getForwardVector().multiplyScalar(-speedDelta));
    if (keyStates['KeyA']) playerVelocity.add(getSideVector().multiplyScalar(-speedDelta));
    if (keyStates['KeyD']) playerVelocity.add(getSideVector().multiplyScalar(speedDelta));

    if (running && playerVelocity.lengthSq() > 1 && playerOnFloor) {
        stamina -= deltaTime * 8;

        if (stamina <= 0) {
            stamina = 0;
            isTired = true;
        }

        updateHud();
    }
}

function resolveCameraCollision(from, desired) {
    resolvedCameraPos.copy(desired);

    if (!worldReady) return resolvedCameraPos;

    const dir = vector5.copy(desired).sub(from);
    const distance = dir.length();

    if (distance < 0.001) return resolvedCameraPos;

    dir.normalize();

    const rayResult = worldOctree.rayIntersect(new THREE.Ray(from.clone(), dir));

    if (rayResult && rayResult.distance < distance) {
        const safeDistance = Math.max(0.1, rayResult.distance - GAME_CONFIG.camera.collisionRadius);
        resolvedCameraPos.copy(from).addScaledVector(dir, safeDistance);
    }

    return resolvedCameraPos;
}

function updateThirdPersonCamera(deltaTime) {
    headPosition.copy(playerCollider.end);

    const camDirection = vector2.set(
        Math.sin(yaw) * Math.cos(pitch),
        Math.sin(pitch),
        Math.cos(yaw) * Math.cos(pitch)
    ).normalize();

    desiredCameraPos.copy(headPosition).addScaledVector(camDirection, -params.cameraDistance);
    desiredCameraPos.y += params.cameraHeight;

    const lookOrigin = vector6.copy(headPosition);
    lookOrigin.y += 0.18;

    resolveCameraCollision(lookOrigin, desiredCameraPos);

    const smoothedPos = camera.position.clone();

    if (currentShake.offset.lengthSq() > 0.0001) {
        smoothedPos.sub(currentShake.offset);
    }

    smoothedPos.lerp(resolvedCameraPos, Math.min(1, GAME_CONFIG.camera.followSpeed * deltaTime));
    smoothedPos.add(currentShake.offset);

    camera.position.copy(smoothedPos);

    cameraTarget.copy(headPosition);
    cameraTarget.y += 0.25;
    camera.lookAt(cameraTarget);
}

function updatePlayer(deltaTime) {
    let damping = Math.exp(-4 * deltaTime) - 1;

    if (!playerOnFloor) {
        playerVelocity.y -= GAME_CONFIG.physics.gravity * deltaTime;
        damping *= 0.15;
    }

    playerVelocity.addScaledVector(playerVelocity, damping);

    const horizontalSpeed = Math.sqrt(playerVelocity.x * playerVelocity.x + playerVelocity.z * playerVelocity.z);
    const maxHorizontal = GAME_CONFIG.physics.maxSpeed;

    if (horizontalSpeed > maxHorizontal) {
        const scale = maxHorizontal / horizontalSpeed;
        playerVelocity.x *= scale;
        playerVelocity.z *= scale;
    }

    const deltaPosition = vector3.copy(playerVelocity).multiplyScalar(deltaTime);
    playerCollider.translate(deltaPosition);

    playerCollisions();

    const px = (playerCollider.start.x + playerCollider.end.x) * 0.5;
    const pz = (playerCollider.start.z + playerCollider.end.z) * 0.5;

    for (const target of targetObjects) {
        const dx = px - target.position.x;
        const dz = pz - target.position.z;
        const distSq = (dx * dx) + (dz * dz);
        const minDist = target.radius + PLAYER_RADIUS + 0.15;

        if (distSq < (minDist * minDist) && distSq > 0.0001) {
            const dist = Math.sqrt(distSq);
            const overlap = minDist - dist;
            playerCollider.translate(new THREE.Vector3((dx / dist) * overlap, 0, (dz / dist) * overlap));
        }
    }

    keepPlayerInsideBounds();
    updateThirdPersonCamera(deltaTime);
}

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

function setPlayerSpawn() {
    const spawnX = worldInfo.center.x;
    const spawnZ = worldInfo.center.z + worldInfo.halfDepth * 0.35;
    const spawnY = worldInfo.floorY + 2.0;

    playerCollider.start.set(spawnX, spawnY, spawnZ);
    playerCollider.end.set(spawnX, spawnY + (PLAYER_HEIGHT - PLAYER_RADIUS), spawnZ);
    playerVelocity.set(0, 0, 0);

    yaw = Math.PI;
    pitch = -0.12;

    updateThirdPersonCamera(1);
}

function teleportPlayerIfOob() {
    const playerY = (playerCollider.start.y + playerCollider.end.y) * 0.5;
    if (playerY < worldInfo.floorY - 10) setPlayerSpawn();
}

function fitModelToRing(root) {
    tempBox.setFromObject(root);
    tempBox.getSize(tempSize);
    tempBox.getCenter(tempCenter);

    const currentMaxXZ = Math.max(tempSize.x, tempSize.z);
    const autoScale = currentMaxXZ > 0 ? 14 / currentMaxXZ : 1;

    root.scale.setScalar(autoScale);
    root.updateMatrixWorld(true);

    tempBox.setFromObject(root);
    tempBox.getCenter(tempCenter);

    root.position.x -= tempCenter.x;
    root.position.z -= tempCenter.z;
    root.position.y -= tempBox.min.y;
    root.updateMatrixWorld(true);

    worldInfo.modelScale = autoScale;
}

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
// RONDA Y ESTADOS DE JUEGO
// =========================
function endRound(reason) {
    roundEnded = true;
    pointerLocked = false;
    document.exitPointerLock();

    updateHud();

    if (score >= 250) {
        isVictorious = true;
        fadeToAction('victory', 0.5);
        showMessage(`¡Victoria!\nScore final: ${score}\n\nPresiona 'R' para reiniciar`);
    } else {
        fadeToAction('Idle', 0.5);
        showMessage(`Fin del round\nScore final: ${score}\n\nPresiona 'R' para reiniciar`);
    }
}

function updateGameState(deltaTime) {
    if (roundEnded) return;

    if (!attackState && !boxerActions.reaction?.isRunning() && !keyStates['ShiftLeft']) {
        stamina += deltaTime * 5;
        if (stamina > 100) stamina = 100;
    }

    if (isTired && stamina >= 25) {
        isTired = false;
        if (!attackState) fadeToAction('Idle', 0.3);
    }

    timeLeft -= deltaTime;
    if (timeLeft <= 0) {
        timeLeft = 0;
        endRound('time');
    }

    if (comboTimer > 0) {
        comboTimer -= deltaTime;
        if (comboTimer <= 0) combo = 0;
    }

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
                        child.material.forEach(mat => {
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
            console.error('Error cargando props:', error);
        }

        try {
            await loadBoxer();
            updateBoxerTransform(0);
            fadeToAction('Idle', 0.01);
        } catch (error) {
            console.error('Error cargando boxeador FBX:', error);
        }

        hitParticles = new HitParticleManager(scene);

        worldReady = true;
        hideMessage();
        updateHud();
    },
    undefined,
    (error) => console.error('Error cargando ring.glb:', error)
);

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// =========================
// ANIMACIÓN PRINCIPAL
// =========================
function animate() {
    timer.update();

    const deltaTime = Math.min(0.05, timer.getDelta()) / STEPS_PER_FRAME;

    if (worldReady) {
        const fullDelta = deltaTime * STEPS_PER_FRAME;

        if (currentShake.duration > 0) {
            currentShake.duration -= fullDelta;

            if (currentShake.duration <= 0) {
                currentShake.duration = 0;
                currentShake.intensity = 0;
                currentShake.offset.set(0, 0, 0);
            } else {
                currentShake.intensity *= Math.exp(-5.0 * fullDelta);

                currentShake.offset.set(
                    (Math.random() - 0.5) * currentShake.intensity,
                    (Math.random() - 0.5) * currentShake.intensity,
                    (Math.random() - 0.5) * currentShake.intensity
                );
            }
        }

        if (hitParticles) hitParticles.update(fullDelta);

        for (let i = 0; i < STEPS_PER_FRAME; i++) {
            controls(deltaTime);
            updatePlayer(deltaTime);
            teleportPlayerIfOob();
        }

        updateAttack(fullDelta);
        updateBoxerTransform(fullDelta);
        updateAnimationState();
        updateTargets(fullDelta);
        updateGameState(fullDelta);

        if (boxerMixer) boxerMixer.update(fullDelta);
    }

    const t = performance.now() * 0.001;
    directionalLight.position.x = Math.sin(t * 0.2) * 10;
    directionalLight.position.z = Math.cos(t * 0.2) * 10;

    renderer.render(scene, camera);
    stats.update();
}

// =========================================================
// GESTOR DE PARTÍCULAS DE IMPACTO
// =========================================================
class HitParticleManager {
    constructor(scene, maxParticles = 140) {
        this.maxParticles = maxParticles;
        this.activeParticles = [];

        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(maxParticles * 3);
        const colors = new Float32Array(maxParticles * 3);

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setDrawRange(0, 0);

        this.material = new THREE.PointsMaterial({
            size: 0.17,
            vertexColors: true,
            blending: THREE.AdditiveBlending,
            transparent: true,
            opacity: 1,
            depthWrite: false,
            depthTest: true
        });

        this.points = new THREE.Points(geometry, this.material);
        this.points.frustumCulled = false;
        scene.add(this.points);
    }

    emit(point, direction, count = 8) {
        for (let i = 0; i < count; i++) {
            const spread = 0.65;

            const velocity = direction.clone().add(new THREE.Vector3(
                (Math.random() - 0.5) * spread,
                Math.random() * 0.9 + 0.15,
                (Math.random() - 0.5) * spread
            )).normalize().multiplyScalar(Math.random() * 2.7 + 1.4);

            this.activeParticles.push({
                position: point.clone(),
                velocity,
                life: 0.45 + Math.random() * 0.35,
                maxLife: 0.45 + Math.random() * 0.35
            });

            if (this.activeParticles.length > this.maxParticles) {
                this.activeParticles.shift();
            }
        }
    }

    update(deltaTime) {
        const positions = this.points.geometry.attributes.position.array;
        const colors = this.points.geometry.attributes.color.array;

        let aliveCount = 0;

        for (let i = this.activeParticles.length - 1; i >= 0; i--) {
            const p = this.activeParticles[i];

            p.life -= deltaTime;
            if (p.life <= 0) {
                this.activeParticles.splice(i, 1);
                continue;
            }

            p.velocity.y -= 8.0 * deltaTime;
            p.velocity.multiplyScalar(Math.exp(-3.0 * deltaTime));
            p.position.addScaledVector(p.velocity, deltaTime);

            const life01 = p.life / p.maxLife;

            positions[aliveCount * 3] = p.position.x;
            positions[aliveCount * 3 + 1] = p.position.y;
            positions[aliveCount * 3 + 2] = p.position.z;

            colors[aliveCount * 3] = 1.0;
            colors[aliveCount * 3 + 1] = 0.45 + 0.45 * life01;
            colors[aliveCount * 3 + 2] = 0.06 + 0.12 * life01;

            aliveCount++;
        }

        for (let i = aliveCount; i < this.maxParticles; i++) {
            positions[i * 3] = 0;
            positions[i * 3 + 1] = -9999;
            positions[i * 3 + 2] = 0;

            colors[i * 3] = 0;
            colors[i * 3 + 1] = 0;
            colors[i * 3 + 2] = 0;
        }

        this.points.geometry.setDrawRange(0, aliveCount);
        this.points.geometry.attributes.position.needsUpdate = true;
        this.points.geometry.attributes.color.needsUpdate = true;

        this.material.opacity = aliveCount > 0 ? 1 : 0;
    }
}