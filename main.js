import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0a0a);

const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.0001, 100);
camera.position.set(0, 0, 0.25);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.minDistance = 0.05;
controls.maxDistance = 1;

scene.add(new THREE.AmbientLight(0xffffff, 0.8));
const k = new THREE.DirectionalLight(0xffffff, 2); k.position.set(0.3, 0.5, 0.5); scene.add(k);
const f = new THREE.DirectionalLight(0xffe0b0, 1.0); f.position.set(-0.5, 0.1, 0.3); scene.add(f);
const r = new THREE.DirectionalLight(0xffffff, 0.8); r.position.set(0, -0.5, -0.3); scene.add(r);

const teeth = {};
let dentalData = null;
let model = null;
let frontView = null;

const loader = new GLTFLoader();
Promise.all([
  fetch('./data.json').then(r => r.json()),
  new Promise((res, rej) => loader.load('./models/anatomy.glb', res, undefined, rej))
]).then(([d, gltf]) => {
  dentalData = d;
  model = gltf.scene;
  scene.add(model);

  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  model.position.sub(center);

  const maxDim = Math.max(size.x, size.y, size.z);
  frontView = {
    cam: new THREE.Vector3(0, maxDim * 0.05, maxDim * 1.4),
    target: new THREE.Vector3(0, 0, 0),
  };
  camera.position.copy(frontView.cam);
  controls.target.copy(frontView.target);
  controls.update();

  // Color bone (ivory) vs teeth (white)
  model.traverse(o => {
    if (!o.isMesh) return;

    // Walk up ancestors to find the identifying group name
    let ancestor = o;
    let groupName = '';
    while (ancestor) {
      if (/^tooth_\d{2}$/.test(ancestor.name) ||
          ancestor.name === 'Mandible' ||
          ancestor.name === 'Maxilla' ||
          ancestor.name === 'Maxilla.l' ||
          ancestor.name === 'Maxilla.r') {
        groupName = ancestor.name;
        break;
      }
      ancestor = ancestor.parent;
    }
    const isTooth = /^tooth_\d{2}$/.test(groupName);

    o.material = new THREE.MeshStandardMaterial({
      color: isTooth ? 0xfafaf5 : 0xd9c79a,   // bright white teeth, ivory bone
      roughness: isTooth ? 0.35 : 0.85,
      metalness: 0.02,
      emissive: isTooth ? 0x101010 : 0x000000,
    });
  });

  model.traverse(o => {
    const m = o.name.match(/^tooth_(\d{2})$/);
    if (!m) return;
    const fdi = m[1];
    if (!dentalData.permanentTeeth[fdi]) return;
    teeth[fdi] = {
      group: o,
      data: dentalData.permanentTeeth[fdi],
      upper: fdi.startsWith('1') || fdi.startsWith('2'),
    };
  });

  for (const fdi in teeth) teeth[fdi].group.visible = false;

  console.log(`Found ${Object.keys(teeth).length} teeth`);
  document.getElementById('loading').classList.add('hidden');
  updateAge(0);
}).catch(e => {
  document.getElementById('loading').textContent = 'Error: ' + e.message;
});

function updateAge(age) {
  document.getElementById('age-value').textContent = age.toFixed(1);
  let visible = 0;
  for (const fdi in teeth) {
    const t = teeth[fdi];
    if (age < t.data.eruption) {
      t.group.visible = false;
      t.group.scale.setScalar(1);
      continue;
    }
    const p = THREE.MathUtils.clamp((age - t.data.eruption) / 0.6, 0, 1);
    t.group.visible = true;
    t.group.scale.setScalar(0.4 + 0.6 * p);
    visible++;
  }
  const total = Object.keys(teeth).length;
  const info = document.getElementById('tooth-info');
  if (visible === 0) info.textContent = 'No teeth erupted';
  else if (visible === total) info.textContent = `All ${total} teeth present`;
  else info.textContent = `${visible} / ${total} teeth present`;
}

document.getElementById('ageSlider')
  .addEventListener('input', e => updateAge(parseFloat(e.target.value)));

window.resetView = function () {
  if (!frontView) return;
  camera.position.copy(frontView.cam);
  controls.target.copy(frontView.target);
  controls.update();
};

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

(function loop() {
  requestAnimationFrame(loop);
  controls.update();
  renderer.render(scene, camera);
})();
