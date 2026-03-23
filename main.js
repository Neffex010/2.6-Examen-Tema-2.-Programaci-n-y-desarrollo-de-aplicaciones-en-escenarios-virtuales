import * as THREE from 'three';
import Stats from 'three/addons/libs/stats.module.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { Octree } from 'three/addons/math/Octree.js';
import { OctreeHelper } from 'three/addons/helpers/OctreeHelper.js';
import { Capsule } from 'three/addons/math/Capsule.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';

// =========================
// DOM UI
// =========================
const startOverlay = document.getElementById('startOverlay');
const countdownOverlay = document.getElementById('countdownOverlay');
const countdownNumber = document.getElementById('countdownNumber');
const resultsOverlay = document.getElementById('resultsOverlay');

const hudGoal = document.getElementById('hudGoal');
const hudRankGoal = document.getElementById('hudRankGoal');

const finalRankEl = document.getElementById('finalRank');
const finalScoreEl = document.getElementById('finalScore');
const finalComboEl = document.getElementById('finalCombo');
const finalHitsEl = document.getElementById('finalHits');
const finalTiredEl = document.getElementById('finalTired');
const finalMessageEl = document.getElementById('finalMessage');

const timer = new THREE.Timer();
timer.connect(document);

// =========================
// CONFIG
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
        collisionRadius: 0.22,
        attackZoomDistance: 4.0,
        impactZoomBoost: 0.22,
        zoomLerp: 8
    },
    round: {
        duration: 60
    },
    scoreRanks: {
        C: 0,
        B: 250,
        A: 400,
        S: 550,
        SS: 700
    },
    storage: {
        bestScoreKey: 'box_training_best_score'
    }
};

const STEPS_PER_FRAME = GAME_CONFIG.physics.stepsPerFrame;

// =========================
// FLOW
// =========================
const FLOW = {
    LOADING: 'loading',
    INTRO: 'intro',
    COUNTDOWN: 'countdown',
    PLAYING: 'playing',
    RESULTS: 'results'
};

let gameFlow = FLOW.LOADING;
let countdownTimer = 0;
let countdownStage = 0;
const countdownSteps = ['3', '2', '1', 'FIGHT'];

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
const audioListener = new THREE.AudioListener();
camera.add(audioListener);

// =========================
// AUDIO
// =========================
const audioLoader = new THREE.AudioLoader();

// 1. Sonido de Ambiente
const ambienteAudio = new THREE.Audio(audioListener);
audioLoader.load('./audios/bgm/ambiente.mp3', (buffer) => {
    ambienteAudio.setBuffer(buffer);
    ambienteAudio.setLoop(true); // Para que se repita infinitamente
    ambienteAudio.setVolume(0.4); // Ajusta el volumen (0.0 a 1.0)
});

// 2. Sonido del Golpe Izquierdo (Jab)
const jabAudio = new THREE.Audio(audioListener);
audioLoader.load('./audios/sfx/golpe_i.mp3', (buffer) => {
    jabAudio.setBuffer(buffer);
    jabAudio.setVolume(0.8);
});

// 3. Sonido del Golpe Derecho (Punching / Clic Derecho)
const golpeDerechoAudio = new THREE.Audio(audioListener);
audioLoader.load('./audios/sfx/golpe_d.mp3', (buffer) => {
    golpeDerechoAudio.setBuffer(buffer);
    golpeDerechoAudio.setVolume(0.85); // Le subimos un poco si quieres que suene más fuerte que el jab
});
// =========================
// RENDERER
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
// HUD DYNAMIC
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

const scoreElement = ensureHudElement('score', 'Score: 0', 180, 18);
const timeElement = ensureHudElement('time', 'Tiempo: 60', 232, 18);
const comboElement = ensureHudElement('combo', 'Combo: x0', 284, 18);
const staminaElement = ensureHudElement('stamina', 'Estamina: 100%', 336, 18);

let comboFxLayer = document.getElementById('combo-fx-layer');
if (!comboFxLayer) {
    comboFxLayer = document.createElement('div');
    comboFxLayer.id = 'combo-fx-layer';
    comboFxLayer.style.position = 'fixed';
    comboFxLayer.style.left = '0';
    comboFxLayer.style.top = '0';
    comboFxLayer.style.width = '100%';
    comboFxLayer.style.height = '100%';
    comboFxLayer.style.pointerEvents = 'none';
    comboFxLayer.style.zIndex = '1400';
    document.body.appendChild(comboFxLayer);
}

// =========================
// LIGHTS
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
// GROUND
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
// PARAMS
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
// WORLD INFO
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
// PLAYER
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
// CHARACTER
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

// =========================
// CONTROLS
// =========================
const keyStates = {};
let pointerLocked = false;

let yaw = 0;
let pitch = -0.12;

// =========================
// AUX VECTORS
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
// GAMEPLAY
// =========================
let score = 0;
let combo = 0;
let maxCombo = 0;
let stamina = 100;
let isTired = false;
let timeLeft = GAME_CONFIG.round.duration;
let comboTimer = 0;
let attackState = null;
let comboHudPulse = 0;
let tiredCount = 0;
let hitsConnected = 0;
let roundEnded = false;
let bestScore = Number(localStorage.getItem(GAME_CONFIG.storage.bestScoreKey) || 0);
let isNewRecord = false;

const ATTACK_CONFIG = {
    jab:      { name: 'jab',      duration: 0.90, activeStart: 0.20, activeEnd: 0.40, range: 0.75, radius: 0.35, score: 20, impulse: 5.5, speed: 1.0, staminaCost: 8 },
    hook:     { name: 'hook',     duration: 1.20, activeStart: 0.35, activeEnd: 0.55, range: 0.70, radius: 0.45, score: 30, impulse: 9.5, speed: 0.95, staminaCost: 15 },
    uppercut: { name: 'uppercut', duration: 1.40, activeStart: 0.40, activeEnd: 0.65, range: 0.65, radius: 0.40, score: 40, impulse: 14.0, speed: 0.9, staminaCost: 25 },
    punching: { name: 'punching', duration: 1.30, activeStart: 0.25, activeEnd: 0.60, range: 1.20, radius: 0.45, score: 25, impulse: 8.5, speed: 0.85, staminaCost: 18 },
    cross:    { name: 'cross',    duration: 1.10, activeStart: 0.30, activeEnd: 0.50, range: 0.85, radius: 0.40, score: 35, impulse: 11.0, speed: 1.0, staminaCost: 20 }
};

// =========================
// TARGETS
// =========================
const targetObjects = [];
const bagGroup = new THREE.Group();
scene.add(bagGroup);
let nextTargetId = 1;

// =========================
// FX / CAMERA
// =========================
const currentShake = {
    intensity: 0,
    duration: 0,
    offset: new THREE.Vector3()
};

let hitParticles = null;
let impactFlashes = null;
let trailManager = null;
let comboFxManager = null;

let combatZoom = 0;
let targetCombatZoom = 0;

function triggerCameraShake(intensity, duration) {
    currentShake.intensity = Math.max(currentShake.intensity, intensity);
    currentShake.duration = Math.max(currentShake.duration, duration);
}

// =========================
// UI HELPERS
// =========================
function getRankFromScore(value) {
    if (value >= GAME_CONFIG.scoreRanks.SS) return 'SS';
    if (value >= GAME_CONFIG.scoreRanks.S) return 'S';
    if (value >= GAME_CONFIG.scoreRanks.A) return 'A';
    if (value >= GAME_CONFIG.scoreRanks.B) return 'B';
    return 'C';
}

function getRankVisual(rank) {
    if (rank === 'SS') {
        return {
            color: '#fff4b0',
            textShadow: '0 0 28px rgba(255,230,120,0.95), 0 0 60px rgba(255,200,60,0.45)',
            bg: 'linear-gradient(135deg, rgba(90,62,0,0.28), rgba(255,210,70,0.10))',
            border: '1px solid rgba(255,220,120,0.45)'
        };
    }
    if (rank === 'S') {
        return {
            color: '#ffd86b',
            textShadow: '0 0 24px rgba(255,216,107,0.9), 0 0 44px rgba(255,170,40,0.35)',
            bg: 'linear-gradient(135deg, rgba(70,40,0,0.22), rgba(255,216,107,0.08))',
            border: '1px solid rgba(255,216,107,0.38)'
        };
    }
    if (rank === 'A') {
        return {
            color: '#7fd6ff',
            textShadow: '0 0 18px rgba(127,214,255,0.7)',
            bg: 'linear-gradient(135deg, rgba(0,40,70,0.22), rgba(127,214,255,0.08))',
            border: '1px solid rgba(127,214,255,0.3)'
        };
    }
    if (rank === 'B') {
        return {
            color: '#c8e2ff',
            textShadow: '0 0 12px rgba(200,226,255,0.35)',
            bg: 'linear-gradient(135deg, rgba(20,30,50,0.22), rgba(200,226,255,0.06))',
            border: '1px solid rgba(200,226,255,0.2)'
        };
    }
    return {
        color: '#ffffff',
        textShadow: '0 0 10px rgba(255,255,255,0.15)',
        bg: 'linear-gradient(135deg, rgba(35,35,40,0.18), rgba(255,255,255,0.04))',
        border: '1px solid rgba(255,255,255,0.12)'
    };
}

function getResultMessage(rank) {
    if (rank === 'SS') return 'Dominaste el entrenamiento. Nivel élite.';
    if (rank === 'S') return 'Excelente round. Tus combinaciones estuvieron brutales.';
    if (rank === 'A') return 'Muy buen desempeño. Ya se siente sólido.';
    if (rank === 'B') return 'Buen trabajo. Vas por buen camino.';
    return 'Sigue entrenando. Todavía puedes mejorar mucho más.';
}

function applyRankVisual(rank) {
    if (!finalRankEl) return;
    const visual = getRankVisual(rank);
    finalRankEl.style.color = visual.color;
    finalRankEl.style.textShadow = visual.textShadow;

    const rankBox = finalRankEl.closest('.results-rank');
    if (rankBox) {
        rankBox.style.background = visual.bg;
        rankBox.style.border = visual.border;
        rankBox.style.boxShadow = `0 0 28px rgba(0,0,0,0.18)`;
    }
}

function updateHud() {
    scoreElement.textContent = `Score: ${score}`;
    timeElement.textContent = `Tiempo: ${Math.max(0, Math.ceil(timeLeft))}`;
    comboElement.textContent = `Combo: x${combo}`;

    if (isTired) {
        staminaElement.style.color = '#ff4444';
        staminaElement.textContent = `¡AGOTADO! (${Math.max(0, Math.ceil(stamina))}%)`;
    } else {
        staminaElement.style.color = '#fff';
        staminaElement.textContent = `Estamina: ${Math.max(0, Math.ceil(stamina))}%`;
    }

    const glowStrength = Math.min(1, combo / 10);
    const scaleBoost = 1 + comboHudPulse * 0.18 + glowStrength * 0.08;

    comboElement.style.transform = `scale(${scaleBoost})`;
    comboElement.style.transformOrigin = 'left center';

    if (combo > 0) {
        comboElement.style.color = combo >= 5 ? '#ffd54a' : '#ffffff';
        comboElement.style.borderColor = combo >= 5
            ? 'rgba(255, 213, 74, 0.95)'
            : 'rgba(255,255,255,0.45)';

        comboElement.style.boxShadow = combo >= 5
            ? `0 0 ${18 + combo * 2}px rgba(255, 204, 64, ${0.25 + glowStrength * 0.35})`
            : `0 0 ${10 + combo * 1.4}px rgba(255,255,255,${0.12 + glowStrength * 0.12})`;

        comboElement.style.background = combo >= 5
            ? 'linear-gradient(135deg, rgba(40,22,0,0.92), rgba(90,55,0,0.88))'
            : 'rgba(18,18,24,0.82)';
    } else {
        comboElement.style.color = '#fff';
        comboElement.style.borderColor = 'rgba(255,215,90,0.75)';
        comboElement.style.boxShadow = '0 8px 22px rgba(0,0,0,0.28)';
        comboElement.style.background = 'rgba(18,18,24,0.82)';
        comboElement.style.transform = 'scale(1)';
    }

    if (hudGoal) hudGoal.textContent = 'Haz el mayor score posible en 60 segundos';
    if (hudRankGoal) hudRankGoal.textContent = `B:250 / A:400 / S:550 / SS:700 / Best:${bestScore}`;
}

function showIntro() {
    gameFlow = FLOW.INTRO;
    startOverlay?.classList.remove('is-hidden');
    countdownOverlay?.classList.add('is-hidden');
    resultsOverlay?.classList.add('is-hidden');
}

function startCountdown() {
    if (!worldReady) return;
    gameFlow = FLOW.COUNTDOWN;
    countdownStage = 0;
    countdownTimer = 1.0;
    if (!ambienteAudio.isPlaying) {
        ambienteAudio.play();
    }
    if (countdownNumber) {
        countdownNumber.textContent = countdownSteps[countdownStage];
        countdownNumber.style.color = '#fff3c8';
        countdownNumber.style.textShadow = '0 0 25px rgba(255,216,107,0.45), 0 4px 18px rgba(0,0,0,0.5)';
    }
    startOverlay?.classList.add('is-hidden');
    resultsOverlay?.classList.add('is-hidden');
    countdownOverlay?.classList.remove('is-hidden');
}

function beginRound() {
    gameFlow = FLOW.PLAYING;
    roundEnded = false;
    timeLeft = GAME_CONFIG.round.duration;
    countdownOverlay?.classList.add('is-hidden');
    updateHud();
    container.requestPointerLock();
}

function showResults() {
    const rank = getRankFromScore(score);

    if (score > bestScore) {
        bestScore = score;
        localStorage.setItem(GAME_CONFIG.storage.bestScoreKey, String(bestScore));
        isNewRecord = true;
    } else {
        isNewRecord = false;
    }

    if (finalRankEl) finalRankEl.textContent = rank;
    if (finalScoreEl) finalScoreEl.textContent = `${score}${isNewRecord ? '  •  NUEVO RÉCORD' : ''}`;
    if (finalComboEl) finalComboEl.textContent = `${maxCombo}`;
    if (finalHitsEl) finalHitsEl.textContent = `${hitsConnected}`;
    if (finalTiredEl) finalTiredEl.textContent = `${tiredCount}`;

    if (finalMessageEl) {
        finalMessageEl.textContent = `${getResultMessage(rank)} Mejor marca: ${bestScore}.`;
    }

    applyRankVisual(rank);
    resultsOverlay?.classList.remove('is-hidden');
    updateHud();
}

function resetRoundStats() {
    score = 0;
    combo = 0;
    maxCombo = 0;
    stamina = 100;
    isTired = false;
    timeLeft = GAME_CONFIG.round.duration;
    comboTimer = 0;
    attackState = null;
    comboHudPulse = 0;
    tiredCount = 0;
    hitsConnected = 0;
    combatZoom = 0;
    targetCombatZoom = 0;
    roundEnded = false;
    isNewRecord = false;

    targetObjects.forEach((t) => {
        t.health = 200;
        t.swing.set(0, 0);
        t.swingVelocity.set(0, 0);
        t.hitFlash = 0;
    });

    if (comboFxManager) comboFxManager.clear();
    setPlayerSpawn();
    updateHud();
    fadeToAction('Idle', 0.2);
}

function finishRound() {
    roundEnded = true;
    gameFlow = FLOW.RESULTS;
    pointerLocked = false;
    document.exitPointerLock();
    showResults();
}

// =========================
// GUI
// =========================
const gui = new GUI({ width: 280 });
gui.title('Box Training 3D');
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
// EVENTS
// =========================
document.addEventListener('keydown', (event) => {
    if ([
        'Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD',
        'KeyQ', 'KeyE', 'KeyF', 'ShiftLeft',
        'ArrowUp', 'ArrowDown', 'KeyR', 'Enter'
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

    if (event.code === 'KeyR' && (gameFlow === FLOW.RESULTS || gameFlow === FLOW.PLAYING)) {
        resetRoundStats();
        resultsOverlay?.classList.add('is-hidden');
        startCountdown();
        return;
    }

    if (!worldReady || gameFlow !== FLOW.PLAYING || roundEnded || isTired) return;
    if (keyStates['Space'] || boxerActions.reaction?.isRunning() || boxerActions.dodging?.isRunning()) return;

    if (event.code === 'KeyF') startAttack('hook');
    if (event.code === 'KeyQ') startAttack('uppercut');
    if (event.code === 'KeyE') startAttack('cross');
});

document.addEventListener('keyup', (event) => {
    keyStates[event.code] = false;
});

document.addEventListener('mousedown', (event) => {
    if (!worldReady) return;

    if (gameFlow === FLOW.INTRO) {
        startCountdown();
        return;
    }

    if (!pointerLocked || gameFlow !== FLOW.PLAYING || roundEnded || isTired) return;
    if (keyStates['Space'] || boxerActions.reaction?.isRunning() || boxerActions.dodging?.isRunning()) return;

    if (event.button === 0) {
        startAttack('jab');
    } else if (event.button === 2) {
        startAttack('punching');
    }
});

document.addEventListener('contextmenu', (event) => event.preventDefault());

container.addEventListener('click', () => {
    if (!worldReady) return;
    if (gameFlow === FLOW.INTRO) {
        startCountdown();
        return;
    }
    if (gameFlow === FLOW.PLAYING && !roundEnded) {
        container.requestPointerLock();
    }
});

document.addEventListener('pointerlockchange', () => {
    pointerLocked = document.pointerLockElement === container;
});

document.addEventListener('mousemove', (event) => {
    if (!pointerLocked || !worldReady || gameFlow !== FLOW.PLAYING) return;

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
// ANIMATION STATE
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
        if (!attackState && !isTired) fadeToAction('Idle', fadeOut);
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

    if (boxerActions.reaction?.isRunning() || boxerActions.dodging?.isRunning()) return;

    if (isTired) {
        if (attackState) attackState = null;
        if (boxerActions.block) boxerActions.block.setEffectiveTimeScale(0.7);
        fadeToAction('block', 0.3);
        return;
    }

    if (boxerActions.block) boxerActions.block.setEffectiveTimeScale(1.0);
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

    if (horizontalSpeed > 6.2 && keyStates['ShiftLeft']) fadeToAction('run', 0.15);
    else if (horizontalSpeed > 0.18) fadeToAction('walk', 0.15);
    else fadeToAction('Idle', 0.2);
}

// =========================
// DEFENSE
// =========================
function triggerDodge() {
    if (!playerOnFloor || stamina < 5) return;

    stamina -= 5;
    stamina = Math.max(0, stamina);
    updateHud();
    playOneShot('dodging', 0.10, 0.25, 0.85);
}

function setTiredState() {
    if (!isTired) tiredCount += 1;
    isTired = true;
}

function triggerBagHit() {
    if (roundEnded || isTired) return;

    attackState = null;
    playOneShot('reaction', 0.05, 0.2, 1.1);

    combo = 0;
    comboTimer = 0;
    stamina -= 20;

    if (stamina <= 0) {
        stamina = 0;
        setTiredState();
    }

    updateHud();
    triggerCameraShake(0.12, 0.3);
}

// =========================
// ATTACKS
// =========================
function startAttack(name) {
    if (attackState || isTired || !ATTACK_CONFIG[name]) return;
    const cfg = ATTACK_CONFIG[name];

    if (stamina < cfg.staminaCost) {
        stamina = 0;
        setTiredState();
        updateHud();
        return;
    }

    stamina -= cfg.staminaCost;
    updateHud();
    if (name === 'jab') {
        if (jabAudio.isPlaying) jabAudio.stop(); // Lo detiene si ya estaba sonando
        jabAudio.play();
    } else if (name === 'punching') {
        if (golpeDerechoAudio.isPlaying) golpeDerechoAudio.stop();
        golpeDerechoAudio.play();
    }

    attackState = {
        name: cfg.name,
        timer: 0,
        duration: cfg.duration,
        activeStart: cfg.activeStart,
        activeEnd: cfg.activeEnd,
        hitTargets: new Set()
    };

    targetCombatZoom = 1.0;
    playOneShot(name, 0.05, 0.2, cfg.speed);
}

function spawnAttackTrail() {
    if (!trailManager || !attackState || !boxer) return;

    const playerCenter = new THREE.Vector3(
        (playerCollider.start.x + playerCollider.end.x) * 0.5,
        playerCollider.start.y + 1.15,
        (playerCollider.start.z + playerCollider.end.z) * 0.5
    );

    const forward = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)).normalize();
    const right = new THREE.Vector3(forward.z, 0, -forward.x).normalize();

    let sideOffset = 0.28;
    let reach = 0.75;

    if (attackState.name === 'hook') {
        sideOffset = 0.42;
        reach = 0.82;
    } else if (attackState.name === 'uppercut') {
        sideOffset = 0.18;
        reach = 0.62;
    } else if (attackState.name === 'punching') {
        sideOffset = 0.34;
        reach = 1.0;
    }

    const start = playerCenter.clone().addScaledVector(right, sideOffset);
    const end = start.clone().addScaledVector(forward, reach).add(new THREE.Vector3(0, 0.05, 0));

    trailManager.spawnTrail(start, end);
}

function updateAttack(deltaTime) {
    if (!attackState || roundEnded) return;

    attackState.timer += deltaTime;
    const cfg = ATTACK_CONFIG[attackState.name];

    if (attackState.timer >= attackState.activeStart && attackState.timer <= attackState.activeEnd) {
        processAttackHits(cfg, attackState.hitTargets);
        spawnAttackTrail();
    }

    if (attackState.timer >= attackState.duration) {
        attackState = null;
        targetCombatZoom = 0;
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

            hitsConnected += 1;
            combo += 1;
            maxCombo = Math.max(maxCombo, combo);
            comboTimer = 2.3;
            score += cfg.score + Math.max(0, combo - 1) * 5;
            stamina = Math.min(100, stamina + 2);

            if (target.health <= 0) {
                target.health = 200;
                score += 80;
                combo += 1;
                maxCombo = Math.max(maxCombo, combo);
                comboTimer = 2.8;
            }

            const vectorToBagSurface = toTarget.clone().normalize();
            const exactImpactPoint = target.position.clone().sub(
                vectorToBagSurface.multiplyScalar(target.radius)
            );

            exactImpactPoint.y = Math.min(
                playerCollider.end.y - 0.2,
                target.position.y + target.bagHeight / 2
            );

            updateHud();
            comboHudPulse = 1.0;

            if (comboFxManager) {
                comboFxManager.onHit(exactImpactPoint, combo, cfg.score, cfg.name);
            }

            if (hitParticles) {
                const reflectDir = attackForward
                    .clone()
                    .reflect(toTarget.clone().normalize())
                    .negate()
                    .add(new THREE.Vector3(0, 0.45, 0));

                const heavy = cfg.name === 'uppercut' || cfg.name === 'hook';

                hitParticles.emit(
                    exactImpactPoint,
                    reflectDir,
                    heavy ? Math.max(14, Math.floor(cfg.score / 3)) : Math.max(8, Math.floor(cfg.score / 4)),
                    heavy ? 'heavy' : 'hit'
                );
            }

            if (impactFlashes) {
                const flashStrength = cfg.name === 'uppercut' ? 1.45 : (cfg.name === 'hook' ? 1.2 : 1.0);
                impactFlashes.spawn(exactImpactPoint, flashStrength);
            }

            combatZoom = Math.min(1.0, combatZoom + GAME_CONFIG.camera.impactZoomBoost);

            let shakeInt = 0;
            if (cfg.name === 'jab') shakeInt = 0.05;
            if (cfg.name === 'hook' || cfg.name === 'punching') shakeInt = 0.15;
            if (cfg.name === 'uppercut') shakeInt = 0.25;

            triggerCameraShake(shakeInt, 0.3);
        }
    }
}

// =========================
// LOAD CHARACTER
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
        cross: './models/fbx/cross.fbx'
    };

    const entries = Object.entries(animFiles);

    const loadedAnimations = await Promise.all(
        entries.map(async ([name, path]) => {
            try {
                const fbx = await fbxLoader.loadAsync(path);
                if (!fbx.animations || !fbx.animations[0]) return [name, null];
                return [name, fbx.animations[0]];
            } catch (err) {
                console.warn(`No se pudo cargar la animación "${name}"`, err);
                return [name, null];
            }
        })
    );

    for (const [name, clip] of loadedAnimations) {
        if (!clip) continue;
        boxerActions[name] = boxerMixer.clipAction(clip);
    }

    if (!boxerActions.Idle) throw new Error('No se pudo cargar Idle.fbx');

    boxerActions.Idle.play();
    activeAction = boxerActions.Idle;

    scene.add(boxer);
}

// =========================
// BAG
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
// COLLISIONS
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
    if (gameFlow !== FLOW.PLAYING || roundEnded || boxerActions.reaction?.isRunning() || boxerActions.dodging?.isRunning()) return;

    const isBlocking = keyStates['Space'];
    const running = keyStates['ShiftLeft'] && !isBlocking && !isTired;

    let baseSpeed = running
        ? GAME_CONFIG.movement.runSpeed
        : (isBlocking ? 3.8 : GAME_CONFIG.movement.walkSpeed);

    if (attackState) baseSpeed *= 0.05;
    else if (isTired) baseSpeed *= 0.3;

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
            setTiredState();
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

    combatZoom = THREE.MathUtils.lerp(
        combatZoom,
        targetCombatZoom,
        Math.min(1, GAME_CONFIG.camera.zoomLerp * deltaTime)
    );

    const dynamicDistance = THREE.MathUtils.lerp(
        params.cameraDistance,
        GAME_CONFIG.camera.attackZoomDistance,
        combatZoom
    );

    desiredCameraPos.copy(headPosition).addScaledVector(camDirection, -dynamicDistance);
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

    combatZoom *= Math.exp(-4.5 * deltaTime);
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
// FLOW UPDATE
// =========================
function updateFlow(deltaTime) {
    if (gameFlow !== FLOW.COUNTDOWN) return;

    countdownTimer -= deltaTime;

    if (countdownTimer <= 0) {
        countdownStage += 1;

        if (countdownStage >= countdownSteps.length) {
            beginRound();
            return;
        }

        countdownTimer = countdownStage === countdownSteps.length - 1 ? 0.65 : 1.0;

        if (countdownNumber) {
            countdownNumber.textContent = countdownSteps[countdownStage];
            if (countdownSteps[countdownStage] === 'FIGHT') {
                countdownNumber.style.color = '#ffd86b';
                countdownNumber.style.textShadow = '0 0 32px rgba(255,216,107,0.85), 0 0 60px rgba(255,120,0,0.35)';
            }
        }
    }
}

function updateGameState(deltaTime) {
    if (gameFlow !== FLOW.PLAYING || roundEnded) return;

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
        finishRound();
    }

    if (comboTimer > 0) {
        comboTimer -= deltaTime;
        if (comboTimer <= 0) {
            combo = 0;
            comboHudPulse = 0;
        }
    }

    updateHud();
}

// =========================
// LOAD WORLD
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
        } catch {
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
        impactFlashes = new ImpactFlashManager(scene);
        trailManager = new TrailManager(scene);
        comboFxManager = new ComboFxManager(camera, comboFxLayer);

        worldReady = true;
        updateHud();
        showIntro();
    },
    undefined,
    (error) => console.error('Error cargando ring.glb:', error)
);

// =========================
// RESIZE
// =========================
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// =========================
// MAIN LOOP
// =========================
function animate() {
    timer.update();

    const deltaTime = Math.min(0.05, timer.getDelta()) / STEPS_PER_FRAME;

    if (worldReady) {
        const fullDelta = deltaTime * STEPS_PER_FRAME;

        updateFlow(fullDelta);

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
        if (impactFlashes) impactFlashes.update(fullDelta);
        if (trailManager) trailManager.update(fullDelta);
        if (comboFxManager) comboFxManager.update(fullDelta);

        comboHudPulse *= Math.exp(-7.0 * fullDelta);

        for (let i = 0; i < STEPS_PER_FRAME; i++) {
            controls(deltaTime);
            updatePlayer(deltaTime);
            teleportPlayerIfOob();
        }

        if (gameFlow === FLOW.PLAYING) {
            updateAttack(fullDelta);
            updateTargets(fullDelta);
            updateGameState(fullDelta);
        }

        updateBoxerTransform(fullDelta);
        updateAnimationState();

        if (boxerMixer) boxerMixer.update(fullDelta);
    }

    const t = performance.now() * 0.001;
    directionalLight.position.x = Math.sin(t * 0.2) * 10;
    directionalLight.position.z = Math.cos(t * 0.2) * 10;

    renderer.render(scene, camera);
    stats.update();
}

// =========================================================
// PARTICLES
// =========================================================
class HitParticleManager {
    constructor(sceneRef, maxParticles = 260) {
        this.maxParticles = maxParticles;
        this.activeParticles = [];

        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(maxParticles * 3);
        const colors = new Float32Array(maxParticles * 3);

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setDrawRange(0, 0);

        this.material = new THREE.PointsMaterial({
            size: 0.14,
            vertexColors: true,
            blending: THREE.AdditiveBlending,
            transparent: true,
            opacity: 1,
            depthWrite: false,
            depthTest: true
        });

        this.points = new THREE.Points(geometry, this.material);
        this.points.frustumCulled = false;
        sceneRef.add(this.points);
    }

    emit(point, direction, count = 12, style = 'hit') {
        for (let i = 0; i < count; i++) {
            const spread = style === 'heavy' ? 0.95 : 0.65;
            const speed = style === 'heavy'
                ? (Math.random() * 4.0 + 2.0)
                : (Math.random() * 2.6 + 1.2);

            const velocity = direction.clone().add(new THREE.Vector3(
                (Math.random() - 0.5) * spread,
                Math.random() * 0.85,
                (Math.random() - 0.5) * spread
            )).normalize().multiplyScalar(speed);

            const smokeChance = Math.random();
            const life = 0.32 + Math.random() * 0.35;

            this.activeParticles.push({
                position: point.clone(),
                velocity,
                life,
                maxLife: life,
                type: smokeChance > 0.72 ? 'smoke' : 'spark'
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

            if (p.type === 'spark') {
                p.velocity.y -= 8.5 * deltaTime;
                p.velocity.multiplyScalar(Math.exp(-3.5 * deltaTime));
            } else {
                p.velocity.y += 0.6 * deltaTime;
                p.velocity.multiplyScalar(Math.exp(-1.8 * deltaTime));
            }

            p.position.addScaledVector(p.velocity, deltaTime);

            const life01 = p.life / p.maxLife;

            positions[aliveCount * 3] = p.position.x;
            positions[aliveCount * 3 + 1] = p.position.y;
            positions[aliveCount * 3 + 2] = p.position.z;

            if (p.type === 'spark') {
                colors[aliveCount * 3] = 1.0;
                colors[aliveCount * 3 + 1] = 0.5 + 0.4 * life01;
                colors[aliveCount * 3 + 2] = 0.08;
            } else {
                colors[aliveCount * 3] = 0.5 * life01;
                colors[aliveCount * 3 + 1] = 0.5 * life01;
                colors[aliveCount * 3 + 2] = 0.5 * life01;
            }

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
    }
}

// =========================================================
// IMPACT FLASH
// =========================================================
class ImpactFlashManager {
    constructor(sceneRef, maxFlashes = 24) {
        this.scene = sceneRef;
        this.maxFlashes = maxFlashes;
        this.flashes = [];
    }

    spawn(position, strength = 1) {
        const geo = new THREE.SphereGeometry(0.08 * strength, 12, 12);
        const mat = new THREE.MeshBasicMaterial({
            color: 0xfff1b3,
            transparent: true,
            opacity: 1,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(position);
        this.scene.add(mesh);

        this.flashes.push({
            mesh,
            life: 0.10,
            maxLife: 0.10,
            strength
        });

        if (this.flashes.length > this.maxFlashes) {
            const old = this.flashes.shift();
            this.scene.remove(old.mesh);
            old.mesh.geometry.dispose();
            old.mesh.material.dispose();
        }
    }

    update(deltaTime) {
        for (let i = this.flashes.length - 1; i >= 0; i--) {
            const f = this.flashes[i];
            f.life -= deltaTime;

            if (f.life <= 0) {
                this.scene.remove(f.mesh);
                f.mesh.geometry.dispose();
                f.mesh.material.dispose();
                this.flashes.splice(i, 1);
                continue;
            }

            const k = f.life / f.maxLife;
            const grow = 1 + (1 - k) * 2.4 * f.strength;

            f.mesh.scale.setScalar(grow);
            f.mesh.material.opacity = k;
        }
    }
}

// =========================================================
// TRAILS
// =========================================================
class TrailManager {
    constructor(sceneRef, maxPoints = 80) {
        this.scene = sceneRef;
        this.maxPoints = maxPoints;
        this.trails = [];

        this.material = new THREE.MeshBasicMaterial({
            color: 0xffd86b,
            transparent: true,
            opacity: 0.75,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide
        });
    }

    spawnTrail(start, end) {
        const dir = new THREE.Vector3().subVectors(end, start);
        const len = dir.length();
        if (len < 0.001) return;

        const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);

        const geometry = new THREE.PlaneGeometry(len, 0.16);
        const mesh = new THREE.Mesh(geometry, this.material.clone());

        mesh.position.copy(mid);
        mesh.lookAt(end);
        mesh.rotateY(Math.PI / 2);

        const upTilt = Math.random() * 0.5 - 0.25;
        mesh.rotateZ(upTilt);

        this.scene.add(mesh);

        this.trails.push({
            mesh,
            life: 0.12,
            maxLife: 0.12
        });

        if (this.trails.length > this.maxPoints) {
            const old = this.trails.shift();
            this.scene.remove(old.mesh);
            old.mesh.geometry.dispose();
            old.mesh.material.dispose();
        }
    }

    update(deltaTime) {
        for (let i = this.trails.length - 1; i >= 0; i--) {
            const t = this.trails[i];
            t.life -= deltaTime;

            if (t.life <= 0) {
                this.scene.remove(t.mesh);
                t.mesh.geometry.dispose();
                t.mesh.material.dispose();
                this.trails.splice(i, 1);
                continue;
            }

            const k = t.life / t.maxLife;
            t.mesh.material.opacity = 0.75 * k;
            t.mesh.scale.y = 0.7 + (1.0 - k) * 0.8;
            t.mesh.scale.x = 1.0 + (1.0 - k) * 0.25;
        }
    }
}

// =========================================================
// COMBO FX
// =========================================================
class ComboFxManager {
    constructor(cameraRef, layer) {
        this.camera = cameraRef;
        this.layer = layer;
        this.worldTexts = [];
        this.banners = [];
    }

    worldToScreen(worldPos) {
        const p = worldPos.clone().project(this.camera);
        return {
            x: (p.x * 0.5 + 0.5) * window.innerWidth,
            y: (-p.y * 0.5 + 0.5) * window.innerHeight,
            visible: p.z >= -1 && p.z <= 1
        };
    }

    createTextElement(text, classType = 'score') {
        const el = document.createElement('div');
        el.textContent = text;
        el.style.position = 'absolute';
        el.style.left = '0px';
        el.style.top = '0px';
        el.style.transform = 'translate(-50%, -50%)';
        el.style.fontFamily = 'Arial, sans-serif';
        el.style.fontWeight = '900';
        el.style.letterSpacing = '1px';
        el.style.whiteSpace = 'nowrap';
        el.style.pointerEvents = 'none';
        el.style.userSelect = 'none';
        el.style.textShadow = '0 2px 10px rgba(0,0,0,0.55)';
        el.style.filter = 'drop-shadow(0 0 10px rgba(255,255,255,0.15))';

        if (classType === 'score') {
            el.style.fontSize = '26px';
            el.style.color = '#ffd86b';
        } else if (classType === 'attack') {
            el.style.fontSize = '22px';
            el.style.color = '#ffffff';
        } else if (classType === 'combo') {
            el.style.fontSize = '42px';
            el.style.color = '#fff3b0';
        }

        this.layer.appendChild(el);
        return el;
    }

    spawnWorldText(worldPos, text, options = {}) {
        const el = this.createTextElement(text, options.type || 'score');

        this.worldTexts.push({
            el,
            worldPos: worldPos.clone(),
            velocity: new THREE.Vector3(
                (Math.random() - 0.5) * 0.3,
                0.9 + Math.random() * 0.5,
                (Math.random() - 0.5) * 0.3
            ),
            life: options.life ?? 0.7,
            maxLife: options.life ?? 0.7,
            scale: options.scale ?? 1
        });
    }

    spawnComboBanner(comboValue) {
        if (comboValue < 2) return;

        let text = `COMBO x${comboValue}`;
        if (comboValue >= 10) text = `MONSTER COMBO x${comboValue}`;
        else if (comboValue >= 7) text = `INSANE COMBO x${comboValue}`;
        else if (comboValue >= 5) text = `MEGA COMBO x${comboValue}`;
        else if (comboValue >= 3) text = `NICE COMBO x${comboValue}`;

        const el = this.createTextElement(text, 'combo');
        el.style.left = '50%';
        el.style.top = '24%';
        el.style.transform = 'translate(-50%, -50%) scale(0.7)';
        el.style.opacity = '1';
        el.style.color = comboValue >= 5 ? '#ffd54a' : '#ffffff';
        el.style.textShadow = comboValue >= 5
            ? '0 0 22px rgba(255,200,60,0.8), 0 4px 18px rgba(0,0,0,0.7)'
            : '0 2px 10px rgba(0,0,0,0.55)';

        this.banners.push({
            el,
            life: 0.8,
            maxLife: 0.8
        });
    }

    onHit(worldPos, comboValue, scoreValue, attackName) {
        this.spawnWorldText(worldPos.clone().add(new THREE.Vector3(0, 0.35, 0)), `+${scoreValue}`, {
            type: 'score',
            life: 0.8,
            scale: 1
        });

        this.spawnWorldText(worldPos.clone().add(new THREE.Vector3(0, 0.7, 0)), attackName.toUpperCase(), {
            type: 'attack',
            life: 0.6,
            scale: 0.92
        });

        if (comboValue >= 2) {
            this.spawnComboBanner(comboValue);
        }
    }

    update(deltaTime) {
        for (let i = this.worldTexts.length - 1; i >= 0; i--) {
            const t = this.worldTexts[i];
            t.life -= deltaTime;

            if (t.life <= 0) {
                t.el.remove();
                this.worldTexts.splice(i, 1);
                continue;
            }

            t.worldPos.addScaledVector(t.velocity, deltaTime);
            t.velocity.y += 0.3 * deltaTime;

            const k = t.life / t.maxLife;
            const screen = this.worldToScreen(t.worldPos);

            if (!screen.visible) {
                t.el.style.display = 'none';
                continue;
            }

            t.el.style.display = 'block';
            t.el.style.left = `${screen.x}px`;
            t.el.style.top = `${screen.y}px`;
            t.el.style.opacity = `${k}`;
            t.el.style.transform = `translate(-50%, -50%) scale(${0.8 + (1 - k) * 0.35 + t.scale * 0.15})`;
        }

        for (let i = this.banners.length - 1; i >= 0; i--) {
            const b = this.banners[i];
            b.life -= deltaTime;

            if (b.life <= 0) {
                b.el.remove();
                this.banners.splice(i, 1);
                continue;
            }

            const k = b.life / b.maxLife;
            const intro = 1 - Math.min(1, b.life / (b.maxLife * 0.35));
            const scale = 0.7 + intro * 0.45;

            b.el.style.opacity = `${k}`;
            b.el.style.transform = `translate(-50%, -50%) scale(${scale})`;
        }
    }

    clear() {
        for (const t of this.worldTexts) t.el.remove();
        for (const b of this.banners) b.el.remove();
        this.worldTexts.length = 0;
        this.banners.length = 0;
    }
}