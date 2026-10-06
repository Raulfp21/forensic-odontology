import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0a0a);

const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.0001, 100);

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

// ---- Growth model ----
// Child's jaw at birth is ~72% of adult size; reaches 100% around age 16.
// (Simplified uniform scale — not anatomically precise but visually clear.)
const GROWTH_MIN = 0.72;
const GROWTH_MAX_AGE = 16;
function growthScale(age) {
  if (age >= GROWTH_MAX_AGE) return 1.0;
  if (age < 0) age = 0;
  return GROWTH_MIN + (1.0 - GROWTH_MIN) * (age / GROWTH_MAX_AGE);
}

const deciduous = {};
const permanent = {};
const wisdom = {};  // unused — teeth come from GLB
const teeth = {};   // unified map for FDI chart API
let dentalData = null;
let frontView = null;
let maxDim = 0.15;
let worldGroup = null;    // wraps the entire model so we can scale it

function setStatus(msg) {
  const el = document.getElementById('loading');
  el.classList.remove('hidden');
  el.textContent = msg;
  console.log('[status]', msg);
}

fetch('./data.json?v=20261006b')
  .then(r => {
    if (!r.ok) throw new Error('data.json HTTP ' + r.status);
    return r.json();
  })
  .then(d => {
    dentalData = d;
    setStatus('Data loaded. Loading model...');
    return loadGLB('./models/anatomy' + ({v10:'_v10_draco', v12:'_v12_draco'}[new URLSearchParams(location.search).get('model')] || '_v12_draco') + '.glb');
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
    const draco = new DRACOLoader();
    draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
    loader.setDRACOLoader(draco);
    loader.load(
      url,
      g => resolve(g),
      evt => {
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
  // Wrap model in a group so we can scale for growth
  worldGroup = new THREE.Group();
  scene.add(worldGroup);

  const model = gltf.scene;
  worldGroup.add(model);

  // Molars sourced from Dundee — no shell hiding needed

  // Center model at origin, capture adult size for camera
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

  // ---- Materials: fix bone colour mismatch ----
  // Z-Anatomy names: "Mandible", "Maxillar", "Maxillal", "Maxilla.l", "Maxilla.r"
  // Any name starting with Maxill OR Mandib is bone.
  model.traverse(o => {
    if (!o.isMesh || o.visible === false) return;

    let a = o, group = '';
    while (a) {
      if (/^tooth_[5-8]\d$/.test(a.name)) { group = a.name; break; }
      if (/^tooth_\d{2}$/.test(a.name))   { group = a.name; break; }
      if (/^(Maxill|Mandib)/.test(a.name)) { group = a.name; break; }
      a = a.parent;
    }

    const isDecid = /^tooth_[5-8]\d$/.test(group);
    const isPerm  = /^tooth_\d{2}$/.test(group) && !isDecid;
    const isBone  = /^(Maxill|Mandib)/.test(group);

    let color, roughness, emissive;
    if (isDecid)      { color = 0xffffff; roughness = 0.55; emissive = 0x0a0a0a; }
    else if (isPerm)  { color = 0xf0e8cc; roughness = 0.30; emissive = 0x050505; }
    else if (isBone)  { color = 0xd9c79a; roughness = 0.85; emissive = 0x000000; }
    else              { color = 0xd9c79a; roughness = 0.85; emissive = 0x000000; }

    if (isBone) {
      o.material = new THREE.MeshStandardMaterial({
        color: 0xd9c79a, roughness: 0.85, metalness: 0.02,
        side: THREE.DoubleSide, shadowSide: THREE.DoubleSide,
      });
    } else {
      o.material = new THREE.MeshStandardMaterial({
        color, roughness, metalness: 0.02, emissive,
      });
    }
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

  for (const fdi in deciduous) deciduous[fdi].group.visible = false;
  for (const fdi in permanent) permanent[fdi].group.visible = false;
  for (const fdi in wisdom) wisdom[fdi].group.visible = false;

  if (new URLSearchParams(location.search).has('xray')) {
    const isTooth = o => { for (let n = o; n; n = n.parent) if (/^tooth_/.test(n.name)) return true; return false; };
    model.traverse(o => {
      if (!o.isMesh || isTooth(o)) return;
      o.material.transparent = true; o.material.opacity = 0.3; o.material.depthWrite = false;
    });
  }

  // Merge into unified teeth map for FDI chart API
  for (const fdi in deciduous) teeth[fdi] = deciduous[fdi];
  for (const fdi in permanent) teeth[fdi] = permanent[fdi];
  for (const fdi in wisdom)    teeth[fdi] = wisdom[fdi];

  console.log(`Loaded: ${Object.keys(deciduous).length}D / ${Object.keys(permanent).length}P / ${Object.keys(wisdom).length}W`);
}

// Textbook gives eruption as a RANGE (people vary). A tooth first appears at the
// range start and finishes erupting at the range end. Min width keeps very narrow
// ranges (e.g. deciduous canine, ~1 month) visible as a short animation.
function eruptWindow(data, fallbackWidth) {
  const r = data.eruptionRange;
  if (r && r.length === 2) return [r[0], Math.max(r[1], r[0] + 0.25)];
  return [data.eruption, data.eruption + fallbackWidth];
}

function updateAge(age) {
  const masked = document.body.classList.contains('mj-active');
  document.getElementById('age-value').textContent = masked ? '?' : age.toFixed(1);

  // ---- Jaw growth: scale the whole model ----
  const growth = growthScale(age);
  if (worldGroup) worldGroup.scale.setScalar(growth);

  let d = 0, p = 0, w = 0, er = 0;

  for (const fdi in deciduous) {
    const t = deciduous[fdi];
    const [start, hiE] = eruptWindow(t.data, 0.5), end = t.data.fall;
    if (age < start || age >= end + 0.5) {
      t.group.visible = false;
      t.group.position.y = t.baseY;
      t.group.scale.setScalar(1);
      continue;
    }
    const ep = THREE.MathUtils.clamp((age - start) / (hiE - start), 0, 1);
    let s = 0.4 + 0.6 * ep;
    if (ep < 1) er++;
    if (age > end - 1.0) s = Math.min(s, Math.max(0.1, 1.0 - (age - (end - 1.0))));
    t.group.visible = true;
    t.group.scale.setScalar(s);
    t.group.position.y = t.baseY;
    d++;
  }

  for (const fdi in permanent) {
    const t = permanent[fdi];
    const [lo, hi] = eruptWindow(t.data, 0.6);
    if (age < lo) { t.group.visible = false; t.group.scale.setScalar(1); continue; }
    const pp = THREE.MathUtils.clamp((age - lo) / (hi - lo), 0, 1);
    t.group.visible = true;
    t.group.scale.setScalar(0.4 + 0.6 * pp);
    if (pp < 1) er++;
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
  else { const eTxt = er ? ` (${er} still erupting)` : ''; info.textContent = `${d} deciduous · ${p} permanent${eTxt}` + (masked ? '' : ` · jaw ${Math.round(growth * 100)}%`); }
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


// ----- External API for FDI chart module -----
window.appAPI = {
  getTeethMap() { return teeth; },
  getDentalData() { return dentalData; },
  getCurrentAge() { const s = document.getElementById('ageSlider'); return s ? parseFloat(s.value) : 0; },
  highlightTooth(fdi, hex = 0x4ade80) {
    const t = teeth[fdi]; if (!t) return false;
    t.group.traverse(o => {
      if (!o.isMesh) return;
      if (!o.userData._origEmissive) o.userData._origEmissive = o.material.emissive.clone();
      if (!o.userData._highlightMat) {
        o.userData._highlightMat = o.material.clone();
        o.userData._highlightMat.emissive = new THREE.Color(hex);
        o.userData._highlightMat.emissiveIntensity = 1.4;
      }
      o.material = o.userData._highlightMat;
    });
    return true;
  },
  clearHighlight(fdi) {
    const t = teeth[fdi]; if (!t) return;
    t.group.traverse(o => {
      if (o.isMesh && o.userData._origEmissive) o.material.emissive.copy(o.userData._origEmissive);
    });
  },
  clearAllHighlights() { for (const fdi in teeth) window.appAPI.clearHighlight(fdi); }
};

(function loop() {
  requestAnimationFrame(loop);
  controls.update();
  renderer.render(scene, camera);
})();

// First-load hint — fades on first slider touch
(function(){
  const slider = document.getElementById('ageSlider');
  if (!slider) return;
  const hint = document.createElement('div');
  hint.id = 'first-hint';
  hint.textContent = 'Teeth erupt across a RANGE of ages, not one date. Drag the slider.';
  Object.assign(hint.style, { top: '92px', bottom: 'auto', left: '12px', transform: 'none', maxWidth: 'calc(100vw - 150px)', whiteSpace: 'normal', textAlign: 'left' });
  document.body.appendChild(hint);
  const style = document.createElement('style');
  style.textContent = `
    #first-hint {
      position: fixed; bottom: 108px; left: 50%; transform: translateX(-50%);
      background: rgba(74,222,128,0.15);
      border: 1px solid #4ade80; border-radius: 20px;
      padding: 8px 18px; color: #4ade80;
      font-family: system-ui, sans-serif; font-size: 0.8em;
      font-weight: 600; z-index: 20; transition: opacity 0.4s;
      pointer-events: none; max-width: 88vw; text-align: center;
      white-space: nowrap;
    }
  `;
  document.head.appendChild(style);
  slider.addEventListener('input', () => {
    hint.style.opacity = '0';
    setTimeout(() => hint.remove(), 500);
  }, { once: true });
})();

// Debug: show which teeth are currently visible
window.__teethDbg = function() {
  const data = dentalData;
  const age = parseFloat(document.getElementById('ageSlider').value);
  const vis = [];
  for (const fdi in teeth) {
    const t = teeth[fdi];
    if (t.group.visible) vis.push(fdi);
  }
  console.log('Age', age, '| visible:', vis.sort().join(','));
  if (window.__diagShow) window.__diagShow('Age ' + age + ' | ' + vis.sort().join(','));
};
