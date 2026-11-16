
"use strict";

// =====================================
// NEON STRIKE 3D - GAME ENGINE
// =====================================

const $ = id => document.getElementById(id);

const game = $("game");

if (typeof THREE === "undefined") {
  $("status").textContent =
    "3D引擎加载失败，请检查网络后刷新网页。";
  throw new Error("Three.js failed to load");
}

// =====================================
// 游戏变量
// =====================================

let scene, camera, renderer, clock;

let running = false;
let gameOver = false;

let score = 0;
let wave = 1;
let health = 100;

let enemies = [];
let effects = [];

let keys = {};

let yaw = 0;
let pitch = 0;

let shootCooldown = 0;
let waveTimer = 0;

let moveX = 0;
let moveZ = 0;

let lookPointer = null;
let lastLookX = 0;
let lastLookY = 0;

const raycaster = new THREE.Raycaster();
const center = new THREE.Vector2(0, 0);

// =====================================
// 材质
// =====================================

function makeMaterial(color, glow = color) {
  return new THREE.MeshStandardMaterial({
    color: color,
    emissive: glow,
    emissiveIntensity: 0.45,
    metalness: 0.5,
    roughness: 0.35
  });
}

// =====================================
// 创建方块
// =====================================

function createBox(
  width,
  height,
  depth,
  material,
  x,
  y,
  z
) {
  const object = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    material
  );

  object.position.set(x, y, z);
  scene.add(object);

  return object;
}

// =====================================
// 初始化3D场景
// =====================================

function initGame() {

  scene = new THREE.Scene();

  scene.background = new THREE.Color(0x050914);

  scene.fog = new THREE.Fog(
    0x050914,
    20,
    65
  );

  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    100
  );

  camera.position.set(0, 1.7, 9);

  camera.rotation.order = "YXZ";

  renderer = new THREE.WebGLRenderer({
    antialias: true
  });

  renderer.setPixelRatio(
    Math.min(window.devicePixelRatio, 1.8)
  );

  renderer.setSize(
    window.innerWidth,
    window.innerHeight
  );

  renderer.outputColorSpace = THREE.SRGBColorSpace;

  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  game.appendChild(renderer.domElement);

  clock = new THREE.Clock();

  // 环境光

  scene.add(
    new THREE.HemisphereLight(
      0x9bdcff,
      0x101426,
      1.7
    )
  );

  const sunlight = new THREE.DirectionalLight(
    0x83dfff,
    1.5
  );

  sunlight.position.set(5, 12, 8);

  scene.add(sunlight);

  // 地面

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(100, 100),
    makeMaterial(0x101c30, 0x071c36)
  );

  floor.rotation.x = -Math.PI / 2;

  floor.position.y = 0;

  scene.add(floor);

  // 地面网格

  const grid = new THREE.GridHelper(
    100,
    70,
    0x16bce8,
    0x19334d
  );

  grid.position.y = 0.02;

  scene.add(grid);

  // 地图墙壁

  const wallMaterial = makeMaterial(
    0x17304e,
    0x0b3155
  );

  createBox(46, 5, 1, wallMaterial, 0, 2.5, -23);
  createBox(46, 5, 1, wallMaterial, 0, 2.5, 23);

  createBox(1, 5, 46, wallMaterial, -23, 2.5, 0);
  createBox(1, 5, 46, wallMaterial, 23, 2.5, 0);

  // 霓虹灯柱

  const neon = makeMaterial(
    0x16dfff,
    0x16bfff
  );

  for (let i = -2; i <= 2; i++) {

    createBox(
      0.15, 4, 0.15,
      neon,
      i * 8, 2, -18
    );

    createBox(
      0.15, 4, 0.15,
      neon,
      i * 8, 2, 18
    );

    createBox(
      0.15, 4, 0.15,
      neon,
      -18, 2, i * 8
    );

    createBox(
      0.15, 4, 0.15,
      neon,
      18, 2, i * 8
    );
  }

  // 地图掩体

  const cover = makeMaterial(
    0x31425d,
    0x102e4b
  );

  const positions = [
    [-9, -7],
    [8, -8],
    [-12, 5],
    [11, 6],
    [0, -14],
    [0, 13]
  ];

  positions.forEach((p, i) => {

    const height = 1.5 + (i % 3) * 0.5;

    createBox(
      3,
      height,
      2,
      cover,
      p[0],
      height / 2,
      p[1]
    );

    createBox(
      3,
      0.07,
      2.05,
      neon,
      p[0],
      height,
      p[1]
    );

  });

  $("status").textContent = "3D引擎加载成功！";

  animate();
}

// =====================================
// 创建机器人敌人
// =====================================

function createEnemy(x, z) {

  const group = new THREE.Group();

  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.55, 1),
    makeMaterial(0x9d315b, 0xff235e)
  );

  group.add(core);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(
      0.78,
      0.07,
      8,
      24
    ),
    makeMaterial(0x27dfff, 0x13aaff)
  );

  ring.rotation.x = Math.PI / 2;

  group.add(ring);

  const eye = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 12, 12),
    makeMaterial(0xffd46b, 0xffa51c)
  );

  eye.position.set(0, 0, 0.48);

  group.add(eye);

  const wingMaterial = makeMaterial(
    0x314b70,
    0x225d8b
  );

  for (const side of [-1, 1]) {

    const wing = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.12, 0.3),
      wingMaterial
    );

    wing.position.x = side * 0.72;

    group.add(wing);
  }

  group.position.set(
    x,
    1.8,
    z
  );

  scene.add(group);

  enemies.push({
    group: group,
    hp: 2,
    speed: 1.2 + wave * 0.12,
    phase: Math.random() * 6,
    attackTimer: 0
  });

}

// =====================================
// 生成敌人波次
// =====================================

function spawnWave() {

  const amount = Math.min(
    4 + wave * 2,
    22
  );

  for (let i = 0; i < amount; i++) {

    let x, z;

    do {

      x = (Math.random() - 0.5) * 34;
      z = (Math.random() - 0.5) * 34;

    } while (
      Math.hypot(
        x - camera.position.x,
        z - camera.position.z
      ) < 9
    );

    createEnemy(x, z);
  }

  $("wave").textContent = wave;

  $("enemies").textContent = enemies.length;
}

// =====================================
// 粒子效果
// =====================================

function explosion(position) {

  const group = new THREE.Group();

  group.position.copy(position);

  scene.add(group);

  for (let i = 0; i < 10; i++) {

    const particle = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 6, 6),
      new THREE.MeshBasicMaterial({
        color: 0x4beaff
      })
    );

    particle.position.set(
      (Math.random() - 0.5) * 0.8,
      (Math.random() - 0.5) * 0.8,
      (Math.random() - 0.5) * 0.8
    );

    group.add(particle);
  }

  effects.push({
    object: group,
    life: 0.35
  });

}

// =====================================
// 射击
// =====================================

function shoot() {

  if (
    !running ||
    gameOver ||
    shootCooldown > 0
  ) return;

  shootCooldown = 0.2;

  // 枪口闪光

  const flash = new THREE.PointLight(
    0x48eaff,
    3,
    5
  );

  flash.position.copy(camera.position);

  scene.add(flash);

  effects.push({
    object: flash,
    life: 0.07
  });

  // 射线检测

  raycaster.setFromCamera(
    center,
    camera
  );

  const objects = [];

  enemies.forEach(enemy => {

    enemy.group.traverse(object => {

      if (object.isMesh) {
        objects.push(object);
      }

    });

  });

  const hits = raycaster.intersectObjects(
    objects,
    false
  );

  if (hits.length === 0) return;

  const hit = hits[0];

  const enemy = enemies.find(item => {

    let found = false;

    item.group.traverse(object => {

      if (object === hit.object) {
        found = true;
      }

    });

    return found;
  });

  if (!enemy) return;

  enemy.hp--;

  explosion(hit.point);

  if (enemy.hp <= 0) {

    explosion(enemy.group.position);

    scene.remove(enemy.group);

    enemies = enemies.filter(
      item => item !== enemy
    );

    score += 100;

    $("score").textContent = score;

    $("enemies").textContent = enemies.length;
  }

}

// =====================================
// 玩家移动
// =====================================

function movePlayer(dt) {

  const forward = new THREE.Vector3(
    -Math.sin(yaw),
    0,
    -Math.cos(yaw)
  );

  const right = new THREE.Vector3(
    Math.cos(yaw),
    0,
    -Math.sin(yaw)
  );

  let x =
    (keys.KeyD ? 1 : 0) -
    (keys.KeyA ? 1 : 0) +
    moveX;

  let z =
    (keys.KeyS ? 1 : 0) -
    (keys.KeyW ? 1 : 0) +
    moveZ;

  const length = Math.hypot(x, z) || 1;

  x /= length;
  z /= length;

  camera.position.addScaledVector(
    right,
    x * 7 * dt
  );

  camera.position.addScaledVector(
    forward,
    -z * 7 * dt
  );

  camera.position.x = THREE.MathUtils.clamp(
    camera.position.x,
    -21,
    21
  );

  camera.position.z = THREE.MathUtils.clamp(
    camera.position.z,
    -21,
    21
  );

  camera.position.y = 1.7;

  camera.rotation.set(
    pitch,
    yaw,
    0
  );

}

// =====================================
// 敌人AI
// =====================================

function updateEnemies(dt) {

  enemies.forEach(enemy => {

    enemy.phase += dt * 3;

    enemy.group.position.y =
      1.8 + Math.sin(enemy.phase) * 0.25;

    const dx =
      camera.position.x -
      enemy.group.position.x;

    const dz =
      camera.position.z -
      enemy.group.position.z;

    const distance = Math.hypot(dx, dz) || 1;

    if (distance > 2.1) {

      enemy.group.position.x +=
        dx / distance *
        enemy.speed *
        dt;

      enemy.group.position.z +=
        dz / distance *
        enemy.speed *
        dt;

    } else {

      enemy.attackTimer -= dt;

      if (enemy.attackTimer <= 0) {

        enemy.attackTimer = 0.8;

        health = Math.max(
          0,
          health - 7
        );

        updateHealth();
      }
    }

    enemy.group.lookAt(camera.position);

  });

}

// =====================================
// 更新生命值
// =====================================

function updateHealth() {

  $("healthFill").style.width =
    health + "%";

  $("healthText").textContent =
    health + "%";

}

// =====================================
// 更新粒子
// =====================================

function updateEffects(dt) {

  effects = effects.filter(effect => {

    effect.life -= dt;

    if (effect.life <= 0) {

      scene.remove(effect.object);

      return false;
    }

    return true;
  });

}

// =====================================
// 游戏结束
// =====================================

function endGame() {

  running = false;
  gameOver = true;

  if (document.pointerLockElement) {
    document.exitPointerLock();
  }

  $("title").textContent = "MISSION FAILED";

  $("status").textContent =
    "最终得分：" + score +
    " · 到达波次：" + wave;

  $("start").textContent = "重新开始";

  $("overlay").classList.remove("hidden");

}

// =====================================
// 主游戏更新
// =====================================

function update(dt) {

  if (!running || gameOver) return;

  shootCooldown = Math.max(
    0,
    shootCooldown - dt
  );

  movePlayer(dt);

  updateEnemies(dt);

  updateEffects(dt);

  // 当前波次完成

  if (enemies.length === 0) {

    waveTimer += dt;

    if (waveTimer >= 2) {

      waveTimer = 0;

      wave++;

      spawnWave();
    }
  }

  if (health <= 0) {
    endGame();
  }

}

// =====================================
// 游戏循环
// =====================================

function animate() {

  requestAnimationFrame(animate);

  const dt = Math.min(
    clock.getDelta(),
    0.04
  );

  update(dt);

  renderer.render(
    scene,
    camera
  );

}

// =====================================
// 开始游戏
// =====================================

function startGame() {

  if (!scene) return;

  // 清理旧敌人

  enemies.forEach(enemy => {
    scene.remove(enemy.group);
  });

  enemies = [];

  effects.forEach(effect => {
    scene.remove(effect.object);
  });

  effects = [];

  score = 0;
  wave = 1;
  health = 100;

  yaw = 0;
  pitch = 0;

  waveTimer = 0;

  camera.position.set(0, 1.7, 9);

  $("score").textContent = 0;

  $("wave").textContent = 1;

  $("healthText").textContent = "100%";

  $("healthFill").style.width = "100%";

  running = true;
  gameOver = false;

  spawnWave();

  $("overlay").classList.add("hidden");

  if (
    matchMedia("(pointer:fine)").matches
  ) {
    renderer.domElement.requestPointerLock?.();
  }

}

// =====================================
// 键盘控制
// =====================================

document.addEventListener("keydown", event => {

  keys[event.code] = true;

  if (
    event.code === "Escape" &&
    running
  ) {

    running = false;

    $("title").textContent = "PAUSED";

    $("status").textContent = "游戏已暂停";

    $("start").textContent = "继续游戏";

    $("overlay").classList.remove("hidden");

    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
  }

});

document.addEventListener("keyup", event => {
  keys[event.code] = false;
});

// =====================================
// 鼠标控制
// =====================================

document.addEventListener("mousemove", event => {

  if (
    document.pointerLockElement !== renderer?.domElement ||
    !running
  ) return;

  yaw -= event.movementX * 0.002;

  pitch -= event.movementY * 0.002;

  pitch = THREE.MathUtils.clamp(
    pitch,
    -1.2,
    1.2
  );

});

document.addEventListener("mousedown", event => {

  if (
    event.button === 0 &&
    document.pointerLockElement === renderer?.domElement
  ) {
    shoot();
  }

});

// =====================================
// 手机摇杆
// =====================================

const stick = $("stick");
const knob = $("knob");

function updateStick(event) {

  const rect = stick.getBoundingClientRect();

  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  let dx = event.clientX - centerX;
  let dy = event.clientY - centerY;

  const max = 40;

  const distance = Math.hypot(dx, dy);

  if (distance > max) {

    dx = dx / distance * max;
    dy = dy / distance * max;

  }

  knob.style.transform =
    `translate(${dx}px, ${dy}px)`;

  moveX = dx / max;
  moveZ = dy / max;

}

stick.addEventListener("pointerdown", event => {

  stick.setPointerCapture(event.pointerId);

  updateStick(event);

});

stick.addEventListener("pointermove", event => {

  if (event.buttons) {
    updateStick(event);
  }

});

function resetStick() {

  moveX = 0;
  moveZ = 0;

  knob.style.transform = "translate(0,0)";

}

stick.addEventListener("pointerup", resetStick);

stick.addEventListener("pointercancel", resetStick);

// =====================================
// 手机视角控制
// =====================================

const look = $("look");

look.addEventListener("pointerdown", event => {

  lookPointer = event.pointerId;

  lastLookX = event.clientX;
  lastLookY = event.clientY;

  look.setPointerCapture(event.pointerId);

});

look.addEventListener("pointermove", event => {

  if (lookPointer !== event.pointerId) return;

  yaw -= (event.clientX - lastLookX) * 0.006;

  pitch -= (event.clientY - lastLookY) * 0.005;

  pitch = THREE.MathUtils.clamp(
    pitch,
    -1.2,
    1.2
  );

  lastLookX = event.clientX;
  lastLookY = event.clientY;

});

look.addEventListener("pointerup", () => {
  lookPointer = null;
});

look.addEventListener("pointercancel", () => {
  lookPointer = null;
});

// =====================================
// 手机射击按钮
// =====================================

$("fire").addEventListener(
  "pointerdown",
  event => {
    event.preventDefault();
    shoot();
  }
);

// =====================================
// 开始按钮
// =====================================

$("start").addEventListener("click", () => {

  if (gameOver) {
    startGame();
    return;
  }

  if (!running && health < 100) {

    running = true;

    $("overlay").classList.add("hidden");

    if (matchMedia("(pointer:fine)").matches) {
      renderer.domElement.requestPointerLock?.();
    }

    return;
  }

  startGame();

});

// =====================================
// 屏幕尺寸变化
// =====================================

window.addEventListener("resize", () => {

  if (!camera || !renderer) return;

  camera.aspect =
    window.innerWidth / window.innerHeight;

  camera.updateProjectionMatrix();

  renderer.setSize(
    window.innerWidth,
    window.innerHeight
  );

});

// =====================================
// 启动
// =====================================

try {

  initGame();

} catch (error) {

  console.error(error);

  $("status").textContent =
    "游戏启动失败：" + error.message;

}
