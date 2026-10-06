import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

/* ============================================================
   DATA — book values. Deciduous fall = successor's range[0].
   ============================================================ */
const PERMANENT = {
  '18': { name: 'Upper Right Third Molar',    range: [17, 25] },
  '17': { name: 'Upper Right Second Molar',   range: [12, 14] },
  '16': { name: 'Upper Right First Molar',    range: [6, 7] },
  '15': { name: 'Upper Right Second Premolar',range: [10, 12] },
  '14': { name: 'Upper Right First Premolar', range: [9, 11] },
  '13': { name: 'Upper Right Canine',         range: [11, 12] },
  '12': { name: 'Upper Right Lateral Incisor',range: [7, 9] },
  '11': { name: 'Upper Right Central Incisor',range: [6, 8] },
  '21': { name: 'Upper Left Central Incisor', range: [6, 8] },
  '22': { name: 'Upper Left Lateral Incisor', range: [7, 9] },
  '23': { name: 'Upper Left Canine',          range: [11, 12] },
  '24': { name: 'Upper Left First Premolar',  range: [9, 11] },
  '25': { name: 'Upper Left Second Premolar', range: [10, 12] },
  '26': { name: 'Upper Left First Molar',     range: [6, 7] },
  '27': { name: 'Upper Left Second Molar',    range: [12, 14] },
  '28': { name: 'Upper Left Third Molar',     range: [17, 25] },
  '48': { name: 'Lower Right Third Molar',    range: [17, 25] },
  '47': { name: 'Lower Right Second Molar',   range: [12, 14] },
  '46': { name: 'Lower Right First Molar',    range: [6, 7] },
  '45': { name: 'Lower Right Second Premolar',range: [10, 12] },
  '44': { name: 'Lower Right First Premolar', range: [9, 11] },
  '43': { name: 'Lower Right Canine',         range: [11, 12] },
  '42': { name: 'Lower Right Lateral Incisor',range: [7, 9] },
  '41': { name: 'Lower Right Central Incisor',range: [6, 8] },
  '31': { name: 'Lower Left Central Incisor', range: [6, 8] },
  '32': { name: 'Lower Left Lateral Incisor', range: [7, 9] },
  '33': { name: 'Lower Left Canine',          range: [11, 12] },
  '34': { name: 'Lower Left First Premolar',  range: [9, 11] },
  '35': { name: 'Lower Left Second Premolar', range: [10, 12] },
  '36': { name: 'Lower Left First Molar',     range: [6, 7] },
  '37': { name: 'Lower Left Second Molar',    range: [12, 14] },
  '38': { name: 'Lower Left Third Molar',     range: [17, 25] },
};

// fall = the range start of the permanent successor, so they never overlap.
const DECIDUOUS = {
  '55': { name: 'Upper Right Deciduous Second Molar', range: [1.67, 2.5], fall: 10.0, perm: '15' },
  '54': { name: 'Upper Right Deciduous First Molar',  range: [1.0, 1.17], fall: 9.0,  perm: '14' },
  '53': { name: 'Upper Right Deciduous Canine',       range: [1.42, 1.5],  fall: 11.0, perm: '13' },
  '52': { name: 'Upper Right Deciduous Lateral Incisor', range: [0.58, 0.75], fall: 7.0, perm: '12' },
  '51': { name: 'Upper Right Deciduous Central Incisor', range: [0.58, 0.75], fall: 6.0, perm: '11' },
  '61': { name: 'Upper Left Deciduous Central Incisor',  range: [0.58, 0.75], fall: 6.0, perm: '21' },
  '62': { name: 'Upper Left Deciduous Lateral Incisor',  range: [0.58, 0.75], fall: 7.0, perm: '22' },
  '63': { name: 'Upper Left Deciduous Canine',           range: [1.42, 1.5],  fall: 11.0, perm: '23' },
  '64': { name: 'Upper Left Deciduous First Molar',      range: [1.0, 1.17], fall: 9.0, perm: '24' },
  '65': { name: 'Upper Left Deciduous Second Molar',     range: [1.67, 2.5], fall: 10.0, perm: '25' },
  '85': { name: 'Lower Right Deciduous Second Molar',    range: [1.67, 2.5], fall: 10.0, perm: '45' },
  '84': { name: 'Lower Right Deciduous First Molar',     range: [1.0, 1.17], fall: 9.0, perm: '44' },
  '83': { name: 'Lower Right Deciduous Canine',          range: [1.42, 1.5],  fall: 11.0, perm: '43' },
  '82': { name: 'Lower Right Deciduous Lateral Incisor', range: [0.83, 1.0],  fall: 7.0, perm: '42' },
  '81': { name: 'Lower Right Deciduous Central Incisor', range: [0.5, 0.67],  fall: 6.0, perm: '41' },
  '71': { name: 'Lower Left Deciduous Central Incisor',  range: [0.5, 0.67],  fall: 6.0, perm: '31' },
  '72': { name: 'Lower Left Deciduous Lateral Incisor',  range: [0.83, 1.0],  fall: 7.0, perm: '32' },
  '73': { name: 'Lower Left Deciduous Canine',           range: [1.42, 1.5],  fall: 11.0, perm: '33' },
  '74': { name: 'Lower Left Deciduous First Molar',      range: [1.0, 1.17], fall: 9.0, perm: '34' },
  '75': { name: 'Lower Left Deciduous Second Molar',     range: [1.67, 2.5], fall: 10.0, perm: '35' },
};

const ALL = { ...PERMANENT, ...DECIDUOUS };
const isDeciduous = fdi => '5678'.includes(fdi[0]);
const isUpper = fdi => '1256'.includes(fdi[0]);
const fmtYr = v => v < 2 ? `${Math.round(v * 12)} mo` : `${(+v.toFixed(1))} yr`;
const fmtRange = (lo, hi) => `${fmtYr(lo)} – ${fmtYr(hi)}`;

function isPresent(fdi, age) {
  if (age < ALL[fdi].range[0]) return false;
  if (isDeciduous(fdi) && age >= ALL[fdi].fall) return false;
  return true;
}

const MIRROR = { '1':'2','2':'1','3':'4','4':'3','5':'6','6':'5','7':'8','8':'7' };
const mirror = fdi => MIRROR[fdi[0]] + fdi[1];
const PERM_TO_DECID = {};
for (const d in DECIDUOUS) if (DECIDUOUS[d].perm) PERM_TO_DECID[DECIDUOUS[d].perm] = d;

function bookRule(fdi) {
  if (isDeciduous(fdi)) return 'Deciduous teeth erupt in a regular sequence.';
  const n = fdi[1];
  if (n === '2') return 'Rule 1: lateral incisors erupt earlier in the upper jaw (exception to rule 2).';
  if (n === '8') return 'Rule 3: wisdom teeth erupt first in the lower jaw, left before right.';
  if (isUpper(fdi)) return 'Rule 2: the corresponding lower tooth erupts about 1 year earlier.';
  return 'Rule 2: lower teeth erupt about 1 year before their upper counterparts.';
}

/* ============================================================
   computeBand — endpoints, not midpoints.
   pending = absent AND starts strictly after the last erupted tooth's start,
   so shed deciduous teeth never come back as "next due".
   ============================================================ */
function computeBand(marked) {
  const present = Array.from(marked);
  const lo = present.length ? Math.max(...present.map(f => ALL[f].range[0])) : 0;
  const last = present.length ? present.filter(f => ALL[f].range[0] === lo) : [];
  const pending = Object.keys(ALL).filter(f => !marked.has(f) && ALL[f].range[0] > lo);
  if (!pending.length) return { lo, hi: null, last, next: [], open: true };
  const nextStart = Math.min(...pending.map(f => ALL[f].range[0]));
  const next = pending.filter(f => ALL[f].range[0] === nextStart);
  const hi = Math.min(...pending.map(f => ALL[f].range[1]));
  return { lo, hi, last, next, open: false };
}

/* ============================================================
   SCENE
   ============================================================ */
const canvas = document.getElementById('jaw');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0a0a);
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.0001, 100);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

scene.add(new THREE.AmbientLight(0xffffff, 0.85));
const kl = new THREE.DirectionalLight(0xffffff, 2);   kl.position.set(0.3, 0.5, 0.5); scene.add(kl);
const fl = new THREE.DirectionalLight(0xffe0b0, 1);   fl.position.set(-0.5, 0.1, 0.3); scene.add(fl);
const rl = new THREE.DirectionalLight(0xffffff, 0.8); rl.position.set(0, -0.5, -0.3); scene.add(rl);

const teeth = {};
let maxDim = 0.15;

function loadModel() {
  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader();
    const draco = new DRACOLoader();
    draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
    loader.setDRACOLoader(draco);
    loader.load('models/anatomy_v12_draco.glb', gltf => {
      const model = gltf.scene;
      scene.add(model);
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const centre = box.getCenter(new THREE.Vector3());
      model.position.sub(centre);
      maxDim = Math.max(size.x, size.y, size.z);
      camera.position.set(0, maxDim * 0.1, maxDim * 1.6);
      controls.target.set(0, 0, 0);
      controls.update();

      model.traverse(o => {
        if (!o.isMesh) return;
        let a = o, group = '';
        while (a) {
          if (/^tooth_[5-8]\d$/.test(a.name) || /^tooth_\d{2}$/.test(a.name) ||
              /^(Maxill|Mandib)/.test(a.name)) { group = a.name; break; }
          a = a.parent;
        }
        const isTooth = /^tooth_\d{2}$/.test(group);
        const isDec   = /^tooth_[5-8]\d$/.test(group);
        const isBone  = /^(Maxill|Mandib)/.test(group);
        o.material = new THREE.MeshStandardMaterial({
          color: isDec ? 0xffffff : (isTooth ? 0xf0e8cc : (isBone ? 0xd9c79a : 0x888888)),
          roughness: isTooth ? 0.4 : 0.85,
          metalness: 0.02,
          emissive: 0x000000,
        });
      });
      model.traverse(o => {
        const m = o.name.match(/^tooth_(\d{2})$/);
        if (!m) return;
        if (!ALL[m[1]]) return;
        teeth[m[1]] = { group: o };
      });
      resolve();
    }, undefined, reject);
  });
}

function isShown(o) {
  for (let a = o; a; a = a.parent) if (!a.visible) return false;
  return true;
}

/* ============================================================
   TABS
   ============================================================ */
const panels = {
  learn:    document.getElementById('learn-panel'),
  practice: document.getElementById('practice-panel'),
  test:     document.getElementById('test-panel'),
};
let activeTab = 'learn';
function switchTab(name) {
  activeTab = name;
  for (const k in panels) panels[k].classList.toggle('hidden', k !== name);
  document.querySelectorAll('#tabs button').forEach(b =>
    b.classList.toggle('active', b.dataset.tab === name));
  canvas.style.opacity = (name === 'test') ? '0.12' : '1';
  if (name === 'learn')    renderLearn();
  if (name === 'practice') startPractice();
  if (name === 'test')     startTest();
}
document.querySelectorAll('#tabs button').forEach(b =>
  b.addEventListener('click', () => switchTab(b.dataset.tab)));

/* ============================================================
   LEARN — FDI grid drives the jaw
   ============================================================ */
const learn = { marked: new Set(), auto: true, scrubAge: 0 };

function autoFill() {
  learn.marked.clear();
  for (const fdi in ALL) if (isPresent(fdi, learn.scrubAge)) learn.marked.add(fdi);
}
function toggleFdi(fdi) {
  learn.auto = false;
  const has = learn.marked.has(fdi);
  const m = mirror(fdi);
  if (has) {
    learn.marked.delete(fdi);
    if (m !== fdi) learn.marked.delete(m);
  } else {
    learn.marked.add(fdi);
    if (m !== fdi) learn.marked.add(m);
    const d = PERM_TO_DECID[fdi]; if (d) learn.marked.delete(d);
    const dm = PERM_TO_DECID[m]; if (dm) learn.marked.delete(dm);
  }
  renderLearn();
}
function applyMarkedToJaw() {
  for (const fdi in teeth) {
    teeth[fdi].group.visible = learn.marked.has(fdi);
    teeth[fdi].group.scale.setScalar(1);
  }
}

function buildFdiGrid() {
  const host = document.getElementById('fdi-grid');
  host.innerHTML = '';
  // 4 rows of 8 for permanent (upper-right, upper-left, lower-right, lower-left),
  // then 4 rows of ≤5 for deciduous under each quadrant.
  const layout = [
    ['18','17','16','15','14','13','12','11'],
    ['21','22','23','24','25','26','27','28'],
    ['48','47','46','45','44','43','42','41'],
    ['31','32','33','34','35','36','37','38'],
    ['55','54','53','52','51','', '', ''],
    ['61','62','63','64','65','', '', ''],
    ['85','84','83','82','81','', '', ''],
    ['71','72','73','74','75','', '', ''],
  ];
  const labels = ['Upper right permanent','Upper left permanent','Lower right permanent','Lower left permanent',
                  'Upper right deciduous','Upper left deciduous','Lower right deciduous','Lower left deciduous'];
  layout.forEach((list, i) => {
    const row = document.createElement('div');
    row.className = 'fdi-row';
    row.dataset.label = labels[i];
    list.forEach(fdi => {
      if (!fdi) { const g = document.createElement('div'); g.style.flex='1 1 0'; row.appendChild(g); return; }
      const b = document.createElement('button');
      b.className = 'fdi-cell';
      b.dataset.fdi = fdi;
      b.textContent = fdi;
      b.addEventListener('click', () => toggleFdi(fdi));
      row.appendChild(b);
    });
    host.appendChild(row);
  });
}

function renderLearn() {
  document.querySelectorAll('.fdi-cell').forEach(c => {
    c.classList.toggle('present', learn.marked.has(c.dataset.fdi));
  });
  applyMarkedToJaw();
  const b = computeBand(learn.marked);
  const rangeEl = document.getElementById('learn-range-value');
  const explainEl = document.getElementById('learn-range-explain');
  if (!learn.marked.size) {
    rangeEl.textContent = '—';
    explainEl.textContent = 'Mark teeth on the grid, or use a milestone chip, to compute the range.';
  } else if (b.open) {
    rangeEl.textContent = `≥ ${fmtYr(b.lo)}`;
    explainEl.innerHTML = `Last erupted: <b>${b.last.join(', ')}</b>. No tooth is next due — only a minimum can be given.`;
  } else if (!b.last.length) {
    rangeEl.textContent = `below ${fmtYr(b.hi)}`;
    explainEl.innerHTML = `No tooth has erupted. Next due: <b>${b.next.join(', ')}</b> (upper bound ${fmtYr(b.hi)}).`;
  } else {
    rangeEl.textContent = fmtRange(b.lo, b.hi);
    explainEl.innerHTML = `Last erupted: <b>${b.last.join(', ')}</b> (lower bound ${fmtYr(b.lo)}). Next due: <b>${b.next.join(', ')}</b> (upper bound ${fmtYr(b.hi)}).`;
  }
  document.getElementById('age-label').textContent = learn.scrubAge.toFixed(1);
  document.getElementById('age-slider').value = learn.scrubAge;
}

document.querySelectorAll('.learn-actions button').forEach(b => {
  b.addEventListener('click', () => {
    if (b.dataset.clear !== undefined) { learn.marked.clear(); learn.auto = false; renderLearn(); return; }
    const age = parseFloat(b.dataset.age);
    if (isNaN(age)) return;
    learn.scrubAge = age; learn.auto = true; autoFill(); renderLearn();
  });
});
document.getElementById('age-slider').addEventListener('input', e => {
  learn.scrubAge = parseFloat(e.target.value); learn.auto = true; autoFill(); renderLearn();
});
document.getElementById('age-minus').addEventListener('click', () => {
  learn.scrubAge = Math.max(0, learn.scrubAge - 0.5); learn.auto = true; autoFill(); renderLearn();
});
document.getElementById('age-plus').addEventListener('click', () => {
  learn.scrubAge = Math.min(25, learn.scrubAge + 0.5); learn.auto = true; autoFill(); renderLearn();
});

// Tap jaw → info card (skip invisible)
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
canvas.addEventListener('pointerdown', e => {
  if (activeTab !== 'learn') return;
  ndc.x = (e.clientX / innerWidth) * 2 - 1;
  ndc.y = -(e.clientY / innerHeight) * 2 + 1;
  raycaster.setFromCamera(ndc, camera);
  const hits = raycaster.intersectObjects(scene.children, true);
  for (const h of hits) {
    if (!isShown(h.object)) continue;
    let a = h.object;
    while (a) {
      const m = a.name.match(/^tooth_(\d{2})$/);
      if (m && ALL[m[1]]) { showInfo(m[1]); return; }
      a = a.parent;
    }
  }
});

function showInfo(fdi) {
  const d = ALL[fdi];
  const isDec = isDeciduous(fdi);
  const present = learn.marked.has(fdi);
  document.getElementById('info').innerHTML = `
    <div><span class="code">${fdi}</span> <span class="name">${d.name}</span></div>
    <div class="row"><b>Eruption range:</b> ${fmtRange(d.range[0], d.range[1])}</div>
    ${isDec ? `<div class="row"><b>Sheds:</b> at about ${fmtYr(d.fall)} (successor ${d.perm})</div>` : ''}
    <div class="row"><b>Marked:</b> ${present ? 'present' : 'absent'}</div>
    <div class="rule">${bookRule(fdi)}</div>`;
}

/* ============================================================
   PRACTICE — 5 steps, key checked properly
   ============================================================ */
let P = null;
function pickRandomAge() {
  const r = Math.random();
  if (r < 0.65) return +(6 + Math.random() * 8).toFixed(1);
  if (r < 0.85) return +(3 + Math.random() * 3).toFixed(1);
  if (r < 0.95) return +(14 + Math.random() * 5).toFixed(1);   // cap at 19 to avoid >17 case
  return +(Math.random() * 19).toFixed(1);
}
function applyAutoForPractice(age) {
  for (const fdi in teeth) {
    teeth[fdi].group.visible = isPresent(fdi, age);
    teeth[fdi].group.scale.setScalar(1);
  }
}
function presentSet(age) { return new Set(Object.keys(ALL).filter(f => isPresent(f, age))); }
function pendingList(age) { return Object.keys(ALL).filter(f => !isPresent(f, age) && ALL[f].range[0] > age); }

function startPractice() {
  const age = pickRandomAge();
  applyAutoForPractice(age);
  P = { age, last: null, loTyped: '', next: null, hiTyped: '' };
  renderPractice();
}

function renderPractice() {
  const host = document.getElementById('practice-content');
  const present = Array.from(presentSet(P.age));
  const pending = pendingList(P.age);
  const b = computeBand(presentSet(P.age));
  const trueLo = b.last.length ? ALL[b.last[0]].range[0] : null;
  const trueHi = b.next.length ? Math.min(...b.next.map(f => ALL[f].range[1])) : null;

  host.innerHTML = `
    <div class="step">
      <h3>Step 1 · Which tooth erupted most recently?</h3>
      <p>Of the teeth visible on the jaw, which one is latest in the book's eruption order?</p>
      <div class="fdi-pick" id="pick-last">
        ${present.map(f => `<button data-fdi="${f}" ${P.last===f?'class="picked"':''}>${f}</button>`).join('')}
      </div>
    </div>
    ${P.last ? `
    <div class="step">
      <h3>Step 2 · Lower bound</h3>
      <p>From memory: what is the earliest age at which <b>${P.last}</b> appears?</p>
      <input type="number" step="0.5" id="p-lo" value="${P.loTyped}" placeholder="yr">
    </div>` : ''}
    ${P.loTyped !== '' && pending.length ? `
    <div class="step">
      <h3>Step 3 · Which tooth is next due?</h3>
      <p>Among the FDI codes not on the jaw, which erupts earliest in the book order?</p>
      <div class="fdi-pick" id="pick-next">
        ${pending.map(f => `<button data-fdi="${f}" ${P.next===f?'class="picked"':''}>${f}</button>`).join('')}
      </div>
    </div>` : ''}
    ${P.loTyped !== '' && !pending.length ? `
    <div class="step">
      <h3>Step 3 · Upper bound</h3>
      <p>No textbook tooth is next due — every tooth is on the jaw. In that case <b>only a minimum age</b> can be given.</p>
    </div>` : ''}
    ${P.next ? `
    <div class="step">
      <h3>Step 4 · Upper bound</h3>
      <p>From memory: what is the latest age by which <b>${P.next}</b> should have appeared?</p>
      <input type="number" step="0.5" id="p-hi" value="${P.hiTyped}" placeholder="yr">
    </div>` : ''}
    ${P.next && P.hiTyped !== '' ? `
    <div class="step">
      <h3>Step 5 · Confirm</h3>
      <button class="primary" id="p-reveal">Reveal</button>
    </div>` : ''}
    ${P.loTyped !== '' && !pending.length ? `
    <div class="step">
      <button class="primary" id="p-reveal">Reveal</button>
    </div>` : ''}
    <div id="practice-result"></div>`;

  host.querySelectorAll('#pick-last button').forEach(x =>
    x.onclick = () => { P.last = x.dataset.fdi; P.loTyped=''; P.next=null; P.hiTyped=''; renderPractice(); });
  const lo = host.querySelector('#p-lo');
  if (lo) lo.onchange = () => { P.loTyped = lo.value; renderPractice(); };
  host.querySelectorAll('#pick-next button').forEach(x =>
    x.onclick = () => { P.next = x.dataset.fdi; P.hiTyped=''; renderPractice(); });
  const hi = host.querySelector('#p-hi');
  if (hi) hi.onchange = () => { P.hiTyped = hi.value; renderPractice(); };

  const rev = host.querySelector('#p-reveal');
  if (rev) rev.onclick = () => {
    const loN = parseFloat(P.loTyped);
    const hiN = parseFloat(P.hiTyped);
    const lastOK = b.last.includes(P.last);
    const nextOK = b.next.length === 0 ? (P.next === null) : b.next.includes(P.next);
    const loOK = lastOK && Math.abs(loN - trueLo) < 0.1;
    const hiOK = b.open ? true : (nextOK && Math.abs(hiN - trueHi) < 0.1);

    const lines = [];
    if (!lastOK) lines.push(`<div><span class="no">Step 1 · Last erupted was ${b.last.join(', ')}, not ${P.last}.</span></div>`);
    else if (!loOK) lines.push(`<div><span class="no">Step 2 · Lower bound for ${P.last} is ${fmtYr(trueLo)}.</span></div>`);
    else lines.push(`<div><span class="ok">Step 1–2 correct.</span></div>`);
    if (!b.open) {
      if (!nextOK) lines.push(`<div><span class="no">Step 3 · Next due was ${b.next.join(', ')}, not ${P.next}.</span></div>`);
      else if (!hiOK) lines.push(`<div><span class="no">Step 4 · Upper bound for ${P.next} is ${fmtYr(trueHi)}.</span></div>`);
      else lines.push(`<div><span class="ok">Step 3–4 correct.</span></div>`);
    } else {
      lines.push(`<div><span class="ok">No tooth is next due — only a minimum age applies.</span></div>`);
    }
    const band = b.open ? `≥ ${fmtYr(trueLo)}` : fmtRange(trueLo, trueHi);
    host.querySelector('#practice-result').innerHTML = `
      <div class="result">
        ${lines.join('')}
        <div style="margin-top:8px"><b>Defensible answer:</b> <span class="range">${band}</span></div>
      </div>`;
  };
}

/* ============================================================
   TEST — chart + key derived from same set
   ============================================================ */
let T = null;
function startTest() {
  T = { round: 0, score: 0, total: 10, age: null, last: null, loTyped: '', next: null, hiTyped: '' };
  nextTestRound();
}
function nextTestRound() {
  if (T.round >= T.total) return testSummary();
  T.round++;
  T.age = pickRandomAge();
  T.last = null; T.loTyped = ''; T.next = null; T.hiTyped = '';
  renderTest();
}

// Fixed slot order: two rows of 16 cells per row on wide screens,
// but we render as 4 rows of 8 for phone-width comfort.
const SLOTS = {
  upperR: [['18'],['17'],['16'],['55','15'],['54','14'],['53','13'],['52','12'],['51','11']],
  upperL: [['61','21'],['62','22'],['63','23'],['64','24'],['65','25'],['26'],['27'],['28']],
  lowerR: [['48'],['47'],['46'],['85','45'],['84','44'],['83','43'],['82','42'],['81','41']],
  lowerL: [['71','31'],['72','32'],['73','33'],['74','34'],['75','35'],['36'],['37'],['38']],
};
function slotFdi(slot, set) {
  // permanent wins if present, then deciduous
  for (const f of slot) if (PERMANENT[f] && set.has(f)) return f;
  for (const f of slot) if (set.has(f)) return f;
  return null;
}

function renderTest() {
  const host = document.getElementById('test-content');
  const age = T.age;
  const set = presentSet(age);
  const present = Array.from(set);
  const pending = pendingList(age);

  const row = slots => slots.map(s => {
    const f = slotFdi(s, set);
    return `<div class="cell ${f ? 'present' : ''}">${f || ''}</div>`;
  }).join('');
  const chart = `
    <div class="chart">
      <div class="row">${row(SLOTS.upperR)}</div>
      <div class="row">${row(SLOTS.upperL)}</div>
      <div class="row">${row(SLOTS.lowerR)}</div>
      <div class="row">${row(SLOTS.lowerL)}</div>
    </div>`;

  host.innerHTML = `
    <div style="font-size:0.8em;color:#bbb;margin-bottom:6px">
      <b style="color:#4ade80">Round ${T.round} of ${T.total}</b> · Score ${T.score}
    </div>
    <p style="font-size:0.78em;color:#bbb;line-height:1.45;margin:0 0 8px">
      Dental chart. Green cells show FDI codes of teeth present; blank cells are absent.
    </p>
    ${chart}
    <div class="step" style="border-top:none">
      <h3>1 · Last erupted FDI</h3>
      <div class="fdi-pick" id="pick-last">
        ${present.map(f => `<button data-fdi="${f}" ${T.last===f?'class="picked"':''}>${f}</button>`).join('')}
      </div>
      <h3 style="margin-top:10px">2 · Lower bound (yr)</h3>
      <input type="number" step="0.5" id="t-lo" value="${T.loTyped}" placeholder="from memory">
      ${pending.length ? `
      <h3 style="margin-top:10px">3 · Next due FDI</h3>
      <div class="fdi-pick" id="pick-next">
        ${pending.map(f => `<button data-fdi="${f}" ${T.next===f?'class="picked"':''}>${f}</button>`).join('')}
      </div>
      <h3 style="margin-top:10px">4 · Upper bound (yr)</h3>
      <input type="number" step="0.5" id="t-hi" value="${T.hiTyped}" placeholder="from memory">` : `
      <p style="margin-top:10px;color:#888;font-size:0.8em">No textbook tooth is next due. Only a minimum age can be given.</p>`}
      <button class="primary" id="t-submit" style="margin-top:10px">Submit</button>
    </div>
    <div id="test-result"></div>`;

  host.querySelectorAll('#pick-last button').forEach(x =>
    x.onclick = () => { T.last = x.dataset.fdi; renderTest(); });
  host.querySelectorAll('#pick-next button').forEach(x =>
    x.onclick = () => { T.next = x.dataset.fdi; renderTest(); });
  host.querySelector('#t-submit').onclick = () => {
    T.loTyped = document.getElementById('t-lo').value;
    const hiEl = document.getElementById('t-hi');
    T.hiTyped = hiEl ? hiEl.value : '';
    submitTest();
  };
}

function submitTest() {
  const host = document.getElementById('test-result');
  const lo = T.loTyped === '' ? null : parseFloat(T.loTyped);
  const hi = T.hiTyped === '' ? null : parseFloat(T.hiTyped);
  const set = presentSet(T.age);
  const b = computeBand(set);
  const trueLo = b.last.length ? ALL[b.last[0]].range[0] : null;
  const trueHi = b.next.length ? Math.min(...b.next.map(f => ALL[f].range[1])) : null;

  const lastOK = b.last.length === 0 ? (T.last === null) : b.last.includes(T.last);
  const nextOK = b.next.length === 0 ? (T.next === null) : b.next.includes(T.next);
  const loOK = trueLo === null ? true : (lo !== null && Math.abs(lo - trueLo) < 0.1);
  const hiOK = b.open ? true : (trueHi === null ? true : (hi !== null && Math.abs(hi - trueHi) < 0.1));
  const full = lastOK && nextOK && loOK && hiOK;
  if (full) T.score++;

  const trueRange = b.open ? `≥ ${fmtYr(trueLo)}` : (trueLo !== null && trueHi !== null ? fmtRange(trueLo, trueHi) : '—');
  host.innerHTML = `
    <div class="result">
      <div>${full ? '<span class="ok">Correct.</span>' : '<span class="no">Not quite.</span>'}</div>
      <div style="margin-top:6px"><b>Defensible answer:</b> <span class="range">${trueRange}</span></div>
      <div style="margin-top:6px;color:#aaa;font-size:0.9em">
        <b>Last erupted:</b> ${b.last.join(', ') || '—'} — you said ${T.last || '—'}<br>
        <b>Lower bound:</b> ${trueLo !== null ? fmtYr(trueLo) : '—'} — you said ${lo !== null ? lo : '—'}<br>
        <b>Next due:</b> ${b.next.join(', ') || 'none'} — you said ${T.next || '—'}<br>
        <b>Upper bound:</b> ${trueHi !== null ? fmtYr(trueHi) : (b.open ? 'none (only a minimum)' : '—')} — you said ${hi !== null ? hi : '—'}
      </div>
      <button class="primary" id="t-next" style="margin-top:10px">Next chart</button>
    </div>`;
  host.querySelector('#t-next').onclick = nextTestRound;
}

function testSummary() {
  const host = document.getElementById('test-content');
  const pct = Math.round(100 * T.score / T.total);
  host.innerHTML = `
    <div class="result" style="border-color:#4ade80">
      <div style="font-size:1.15em"><b>Score ${T.score} / ${T.total} (${pct}%)</b></div>
      <button class="primary" id="t-restart" style="margin-top:12px">Try again</button>
    </div>`;
  host.querySelector('#t-restart').onclick = startTest;
}

/* ============================================================
   BOOT
   ============================================================ */
loadModel().then(() => {
  buildFdiGrid();
  learn.scrubAge = 0; learn.auto = true; autoFill(); renderLearn();
  (function animate() { requestAnimationFrame(animate); controls.update(); renderer.render(scene, camera); })();
  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });
}).catch(err => {
  console.error(err);
  document.getElementById('info').innerHTML =
    `<span style="color:#f87171">Failed to load model: ${err.message}</span>`;
});
