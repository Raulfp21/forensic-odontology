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

scene.add(new THREE.AmbientLight(0xffffff, 0.85));
const k = new THREE.DirectionalLight(0xffffff, 2); k.position.set(0.3, 0.5, 0.5); scene.add(k);
const f = new THREE.DirectionalLight(0xffe0b0, 1.0); f.position.set(-0.5, 0.1, 0.3); scene.add(f);
const r = new THREE.DirectionalLight(0xffffff, 0.8); r.position.set(0, -0.5, -0.3); scene.add(r);

const deciduous = {};
const permanent = {};
const wisdom = {};
let dentalData = null;
let frontView = null;
let maxDim = 0.15;

// Per-tooth socket offset (multiples of maxDim) to sink deciduous roots into bone.
// Positive value pushes the tooth INTO its socket.
const DECIDUOUS_SOCKET_OFFSET = {};

function setStatus(msg) {
  const el = document.getElementById('loading');
  el.classList.remove('hidden');
  el.textContent = msg;
  console.log('[status]', msg);
}

// ---- Load data first ----
fetch('./data.json')
  .then(r => {
    if (!r.ok) throw new Error('data.json HTTP ' + r.status);
    return r.json();
  })
  .then(d => {
    dentalData = d;
    setStatus('Data loaded. Loading anatomy.glb (12 MB)...');
    return loadGLB('./models/anatomy.glb');
  })
  .then(gltf => {
    setStatus('Model loaded. Processing...');
    try {
      buildScene(gltf);
      document.getElementById('loading').classList.add('hidden');
      updateAge(0);
    } catch (err) {
      console.error('buildScene failed:', err);
      setStatus('buildScene error: ' + (err && err.message ? err.message : String(err)));
    }
  })
  .catch(err => {
    console.error('Fatal load error:', err);
    setStatus('Error: ' + (err && err.message ? err.message : String(err)));
  });

function loadGLB(url) {
  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader();
    loader.load(
      url,
      g => resolve(g),
      evt => {
        // progress
        if (evt.total) {
          const pct = Math.round(100 * evt.loaded / evt.total);
          setStatus(`Loading model ${pct}%`);
        }
      },
      err => reject(err instanceof Error ? err : new Error('GLB load failed'))
    );
  });
}

function buildScene(gltf) {
  const model = gltf.scene;
  scene.add(model);

  // ---- Hide extra shells on tooth_36 / tooth_46 ----
  ['36', '46'].forEach(fdi => {
    const target = `tooth_${fdi}`;
    let parentGroup = null;
    model.traverse(o => {
      if (!parentGroup && o.name === target) parentGroup = o;
    });
    if (!parentGroup) {
      console.warn('tooth_' + fdi + ' group not found');
      return;
    }
    const meshes = [];
    parentGroup.traverse(o => { if (o.isMesh) meshes.push(o); });
    meshes.sort((a, b) => b.geometry.attributes.position.count - a.geometry.attributes.position.count);
    for (let i = 1; i < meshes.length; i++) meshes[i].visible = false;
    console.log('tooth_' + fdi + ': hid ' + (meshes.length - 1) + ' extra shells');
  });

  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  model.position.sub(center);
  maxDim = Math.max(size.x, size.y, size.z);

  frontView = {
    cam: new THREE.Vector3(0, maxDim * 0.05, maxDim * 1.4),
    target: new THREE.Vector3(0, 0, 0),
  };
  camera.position.copy(frontView.cam);
  controls.target.copy(frontView.target);
  controls.update();

  // ---- Textbook colours ----
  model.traverse(o => {
    if (!o.isMesh || o.visible === false) return;

    let a = o, group = '';
    while (a) {
      if (/^tooth_[5-8]\d$/.test(a.name)) { group = a.name; break; }
      if (/^tooth_\d{2}$/.test(a.name)) { group = a.name; break; }
      if (a.name === 'Mandible' || a.name === 'Maxilla' ||
          a.name === 'Maxilla.l' || a.name === 'Maxilla.r') {
        group = a.name; break;
      }
      a = a.parent;
    }

    const isDecid = /^tooth_[5-8]\d$/.test(group);
    const isPerm = /^tooth_\d{2}$/.test(group);
    const isBone = /^(Mandible|Maxilla)/.test(group);

    let color, roughness, emissive;
    if (isDecid)      { color = 0xffffff; roughness = 0.55; emissive = 0x0a0a0a; }
    else if (isPerm)  { color = 0xf0e8cc; roughness = 0.30; emissive = 0x050505; }
    else if (isBone)  { color = 0xc9b478; roughness = 0.85; emissive = 0x000000; }
    else              { color = 0xaaaaaa; roughness = 0.6;  emissive = 0x000000; }

    o.material = new THREE.MeshStandardMaterial({
      color, roughness, metalness: 0.02, emissive,
    });
  });

  // ---- Register teeth ----
  model.traverse(o => {
    const m = o.name.match(/^tooth_(\d{2})$/);
    if (!m) return;
    const fdi = m[1];

    if (dentalData.deciduousTeeth[fdi]) {
      deciduous[fdi] = { group: o, data: dentalData.deciduousTeeth[fdi], baseY: o.position.y };
    } else if (dentalData.permanentTeeth[fdi]) {
      permanent[fdi] = { group: o, data: dentalData.permanentTeeth[fdi], baseY: o.position.y };
    }
  });

  // ---- Wisdom clones ----
  const wisdomSources = { '38': '37', '48': '47', '18': '17', '28': '27' };
  for (const fdi in dentalData.thirdMolars) {
    const src = permanent[wisdomSources[fdi]];
    if (!src) continue;
    const clone = src.group.clone(true);
    clone.name = `tooth_${fdi}`;
    clone.position.x += (fdi === '28' || fdi === '38' ? 1 : -1) * maxDim * 0.008;
    clone.position.y += (fdi === '18' || fdi === '28' ? -1 : 1) * maxDim * 0.005;
    clone.position.z -= maxDim * 0.13;
    clone.scale.multiplyScalar(0.75);
    src.group.parent.add(clone);
    wisdom[fdi] = { group: clone, data: dentalData.thirdMolars[fdi], baseScale: 0.75 };
  }

  for (const fdi in deciduous) deciduous[fdi].group.visible = false;
  for (const fdi in permanent) permanent[fdi].group.visible = false;
  for (const fdi in wisdom) wisdom[fdi].group.visible = false;

  console.log(`Loaded: ${Object.keys(deciduous).length} deciduous, ${Object.keys(permanent).length} permanent, ${Object.keys(wisdom).length} wisdom`);
}

function updateAge(age) {
  document.getElementById('age-value').textContent = age.toFixed(1);
  let d = 0, p = 0, w = 0;

  for (const fdi in deciduous) {
    const t = deciduous[fdi];
    const start = t.data.eruption, end = t.data.fall;
    if (age < start || age >= end + 0.5) {
      t.group.visible = false;
      t.group.position.y = t.baseY;
      t.group.scale.setScalar(1);
      continue;
    }
    let s = 1;
    if (age < start + 0.5) s = 0.4 + 1.2 * (age - start);
    else if (age > end - 1.0) s = Math.max(0.1, 1.0 - (age - (end - 1.0)));
    t.group.visible = true;
    t.group.scale.setScalar(s);

    const isUpper = /^[56]/.test(fdi);
    const off = (DECIDUOUS_SOCKET_OFFSET[fdi] || 0) * maxDim;
    t.group.position.y = t.baseY + (isUpper ? 1 : -1) * off;
    d++;
  }

  for (const fdi in permanent) {
    const t = permanent[fdi];
    if (age < t.data.eruption) { t.group.visible = false; t.group.scale.setScalar(1); continue; }
    const pp = THREE.MathUtils.clamp((age - t.data.eruption) / 0.6, 0, 1);
    t.group.visible = true;
    t.group.scale.setScalar(0.4 + 0.6 * pp);
    p++;
  }

  for (const fdi in wisdom) {
    const t = wisdom[fdi];
    if (age < t.data.eruption) { t.group.visible = false; t.group.scale.setScalar(t.baseScale); continue; }
    const pp = THREE.MathUtils.clamp((age - t.data.eruption) / 0.6, 0, 1);
    t.group.visible = true;
    t.group.scale.setScalar(t.baseScale * (0.4 + 0.6 * pp));
    w++;
  }

  const info = document.getElementById('tooth-info');
  if (age < 0.5) info.textContent = 'No teeth';
  else info.textContent = `${d} deciduous · ${p} permanent · ${w} wisdom`;
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
