import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// ---------- SCENE ----------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0a0a);

const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.001, 100);
camera.position.set(0, 0, 0.3);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 0.05;
controls.maxDistance = 2;

// ---------- LIGHTS ----------
scene.add(new THREE.AmbientLight(0xffffff, 0.7));
const key = new THREE.DirectionalLight(0xffffff, 2.0);
key.position.set(1, 2, 2);
scene.add(key);
const fill = new THREE.DirectionalLight(0x88bbff, 1.2);
fill.position.set(-2, 0.5, 1);
scene.add(fill);
const rim = new THREE.DirectionalLight(0xffffff, 0.8);
rim.position.set(0, -2, -1);
scene.add(rim);

// ---------- STATE ----------
const teeth = {};        // fdi -> { group, origY, data, upper }
let dentalData = null;
let modelScale = 0.1;

// ---------- LOAD ----------
const loader = new GLTFLoader();

Promise.all([
  fetch('./data.json').then(r => r.json()),
  new Promise((res, rej) => loader.load('./models/anatomy.glb', res, undefined, rej))
]).then(([data, gltf]) => {
  dentalData = data;
  const model = gltf.scene;
  scene.add(model);

  // Center model at origin
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  model.position.sub(center);
  modelScale = Math.max(size.x, size.y, size.z);

  // Camera framing
  camera.position.set(0, modelScale * 0.15, modelScale * 1.6);
  controls.target.set(0, 0, 0);
  controls.update();

  // Materials: white bone/teeth look
  model.traverse(obj => {
    if (obj.isMesh) {
      obj.material = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.55,
        metalness: 0.05,
      });
    }
  });

  // Find tooth groups: name is exactly "tooth_XX"
  model.traverse(obj => {
    const m = obj.name.match(/^tooth_(\d{2})$/);
    if (!m) return;
    const fdi = m[1];
    const info = dentalData.permanentTeeth[fdi];
    if (!info) return;

    const upper = fdi.startsWith('1') || fdi.startsWith('2');
    teeth[fdi] = {
      group: obj,
      origY: obj.position.y,
      data: info,
      upper,
    };
  });

  console.log(`Found ${Object.keys(teeth).length} teeth`);
  document.getElementById('loading').classList.add('hidden');
  updateAge(0);
}).catch(err => {
  console.error(err);
  const l = document.getElementById('loading');
  l.textContent = 'Error: ' + err.message;
});

// ---------- ANIMATION ----------
function updateAge(age) {
  document.getElementById('age-value').textContent = age.toFixed(1);

  // Movement distance: half the model height pushes tooth fully out
  const pushDist = modelScale * 0.08;

  let visible = 0;

  for (const fdi in teeth) {
    const t = teeth[fdi];
    const eruptAge = t.data.eruption;

    // 1-year smooth eruption window starting at eruption age
    const p = THREE.MathUtils.clamp(age - eruptAge, 0, 1);

    // Hide tooth before eruption
    t.group.visible = p > 0;

    // Upper teeth come DOWN from above (+, negative offset)
    // Lower teeth come UP from below (+, positive offset)
    const dir = t.upper ? -1 : 1;

    // When p=0, tooth is fully buried: push it dir*pushDist away from natural position
    // When p=1, tooth is at natural position
    const offset = dir * pushDist * (1 - p);
    t.group.position.y = t.origY + offset;

    // Subtle scale-in effect
    const s = 0.4 + 0.6 * p;
    if (p > 0 && p < 1) {
      t.group.scale.setScalar(s);
    } else {
      t.group.scale.setScalar(1);
    }

    if (p > 0) visible++;
  }

  const info = document.getElementById('tooth-info');
  const total = Object.keys(teeth).length;
  if (visible === 0) info.textContent = 'No teeth erupted';
  else if (visible === total) info.textContent = `All ${total} teeth present`;
  else info.textContent = `${visible} / ${total} teeth present`;
}

// ---------- SLIDER ----------
const slider = document.getElementById('ageSlider');
slider.addEventListener('input', e => updateAge(parseFloat(e.target.value)));

// ---------- RESIZE ----------
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ---------- LOOP ----------
(function loop() {
  requestAnimationFrame(loop);
  controls.update();
  renderer.render(scene, camera);
})();
