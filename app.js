import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

/* ============================================================
   DATA — book values only (Fig 4.21 / Table 4.9 / Table 4.8).
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

const DECIDUOUS = {
  '55': { name: 'Upper Right Deciduous Second Molar', range: [1.67, 2.5], fall: 11.0, perm: null },
  '54': { name: 'Upper Right Deciduous First Molar',  range: [1.0, 1.17], fall: 9.5,  perm: '14' },
  '53': { name: 'Upper Right Deciduous Canine',       range: [1.42, 1.5],  fall: 11.0, perm: '13' },
  '52': { name: 'Upper Right Deciduous Lateral Incisor', range: [0.58, 0.75], fall: 7.0, perm: '12' },
  '51': { name: 'Upper Right Deciduous Central Incisor', range: [0.58, 0.75], fall: 6.5, perm: '11' },
  '61': { name: 'Upper Left Deciduous Central Incisor',  range: [0.58, 0.75], fall: 6.5, perm: '21' },
  '62': { name: 'Upper Left Deciduous Lateral Incisor',  range: [0.58, 0.75], fall: 7.0, perm: '22' },
  '63': { name: 'Upper Left Deciduous Canine',           range: [1.42, 1.5],  fall: 11.0, perm: '23' },
  '64': { name: 'Upper Left Deciduous First Molar',      range: [1.0, 1.17], fall: 9.5, perm: '24' },
  '65': { name: 'Upper Left Deciduous Second Molar',     range: [1.67, 2.5], fall: 11.0, perm: null },
  '85': { name: 'Lower Right Deciduous Second Molar',    range: [1.67, 2.5], fall: 11.0, perm: null },
  '84': { name: 'Lower Right Deciduous First Molar',     range: [1.0, 1.17], fall: 9.5, perm: '44' },
  '83': { name: 'Lower Right Deciduous Canine',          range: [1.42, 1.5],  fall: 10.0, perm: '43' },
  '82': { name: 'Lower Right Deciduous Lateral Incisor', range: [0.83, 1.0],  fall: 6.5, perm: '42' },
  '81': { name: 'Lower Right Deciduous Central Incisor', range: [0.5, 0.67],  fall: 6.0, perm: '41' },
  '71': { name: 'Lower Left Deciduous Central Incisor',  range: [0.5, 0.67],  fall: 6.0, perm: '31' },
  '72': { name: 'Lower Left Deciduous Lateral Incisor',  range: [0.83, 1.0],  fall: 6.5, perm: '32' },
  '73': { name: 'Lower Left Deciduous Canine',           range: [1.42, 1.5],  fall: 10.0, perm: '33' },
  '74': { name: 'Lower Left Deciduous First Molar',      range: [1.0, 1.17], fall: 9.5, perm: '34' },
  '75': { name: 'Lower Left Deciduous Second Molar',     range: [1.67, 2.5], fall: 11.0, perm: null },
};

const ALL = { ...PERMANENT, ...DECIDUOUS };
const isDeciduous = fdi => '5678'.includes(fdi[0]);
const isUpper = fdi => '1256'.includes(fdi[0]);
const fmtYr = v => v < 2 ? `${Math.round(v * 12)} mo` : `${(+v.toFixed(1))} yr`;
const fmtRange = (lo, hi) => `${fmtYr(lo)} – ${fmtYr(hi)}`;

// Eruption is a POINT at the start of the book range.
// Present  ⟺  age >= range[0] and (deciduous: age < fall).
function isPresent(fdi, age) {
  if (age < ALL[fdi].range[0]) return false;
  if (isDeciduous(fdi) && age >= ALL[fdi].fall) return false;
  return true;
}

// Slot-level mirror: left/right pairs erupt together.
const MIRROR = {
  '1':'2','2':'1','3':'4','4':'3','5':'6','6':'5','7':'8','8':'7',
};
const mirror = fdi => MIRROR[fdi[0]] + fdi[1];
const PERM_TO_DECID = {};
for (const d in DECIDUOUS) if (DECIDUOUS[d].perm) PERM_TO_DECID[DECIDUOUS[d].perm] = d;

function bookRule(fdi) {
  if (isDeciduous(fdi)) return 'Deciduous teeth erupt in a more regular sequence than the permanent set.';
  const n = fdi[1];
  if (n === '2') return 'Rule 1 exception: lateral incisors erupt earlier in the upper jaw.';
  if (n === '8') return 'Rule 3: wisdom teeth erupt first in the lower jaw, left before right.';
  if (isUpper(fdi)) return 'Rule 2: the corresponding lower tooth erupts about 1 year earlier.';
  return 'Rule 2: lower teeth erupt about 1 year before their upper counterparts.';
}

/* Compute the defensible age band from a set of marked-present FDI codes. */
function computeBand(marked) {
  const present = Array.from(marked);
  const pending = Object.keys(ALL).filter(f => !marked.has(f));
  if (!present.length) {
    if (!pending.length) return { lo: 0, hi: null, last: [], next: [], open: true };
    const minE = Math.min(...pending.map(f => ALL[f].range[0]));
    const next = pending.filter(f => ALL[f].range[0] === minE);
    return { lo: 0, hi: Math.max(...next.map(f => ALL[f].range[1])), last: [], next, open: false };
  }
  const maxE = Math.max(...present.map(f => ALL[f].range[0]));
  const last = present.filter(f => ALL[f].range[0] === maxE);
  const lo = Math.min(...last.map(f => ALL[f].range[0]));
  if (!pending.length) return { lo, hi: null, last, next: [], open: true };
  const minE = Math.min(...pending.map(f => ALL[f].range[0]));
  const next = pending.filter(f => ALL[f].range[0] === minE);
  const hi = Math.max(...next.map(f => ALL[f].range[1]));
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
   LEARN — the FDI grid drives the jaw
   ============================================================ */
const learn = {
  marked: new Set(),
  auto: true,
  scrubAge: 0,
};

function autoFill() {
  learn.marked.clear();
  for (const fdi in ALL) if (isPresent(fdi, learn.scrubAge)) learn.marked.add(fdi);
}

function toggleFdi(fdi) {
  if (learn.auto) { learn.auto = false; }
  const has = learn.marked.has(fdi);
  if (has) {
    learn.marked.delete(fdi);
  } else {
    // deciduous predecessor in the same slot: replace it
    const dec = PERM_TO_DECID[fdi];
    if (dec) learn.marked.delete(dec);
    learn.marked.add(fdi);
    // mirror on the other side
    const m = mirror(fdi);
    if (m !== fdi && !learn.marked.has(m)) {
      const dm = PERM_TO_DECID[m];
      if (dm) learn.marked.delete(dm);
      learn.marked.add(m);
    }
  }
  renderLearn();
}

function applyMarkedToJaw() {
  for (const fdi in teeth) {
    const show = learn.marked.has(fdi);
    teeth[fdi].group.visible = show;
    teeth[fdi].group.scale.setScalar(1);
  }
}

function buildFdiGrid() {
  const host = document.getElementById('fdi-grid');
  host.innerHTML = '';
  const rows = [
    ['18','17','16','15','14','13','12','11', null, '21','22','23','24','25','26','27','28'],
    ['48','47','46','45','44','43','42','41', null, '31','32','33','34','35','36','37','38'],
  ];
  rows.forEach(list => {
    const row = document.createElement('div');
    row.className = 'fdi-row';
    list.forEach(fdi => {
      if (fdi === null) { const g = document.createElement('div'); g.style.width = '12px'; row.appendChild(g); return; }
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
  // update cells
  document.querySelectorAll('.fdi-cell').forEach(c => {
    const fdi = c.dataset.fdi;
    c.classList.toggle('present', learn.marked.has(fdi));
  });
  applyMarkedToJaw();

  // compute band
  const b = computeBand(learn.marked);
  const rangeEl = document.getElementById('learn-range-value');
  const explainEl = document.getElementById('learn-range-explain');
  if (!learn.marked.size) {
    rangeEl.textContent = '—';
    explainEl.textContent = 'Mark teeth on the grid, or scrub to an age, to compute the range.';
  } else if (b.open) {
    rangeEl.textContent = `≥ ${fmtYr(b.lo)}`;
    explainEl.innerHTML = `Last erupted: <b>${b.last.join(', ')}</b>. No tooth is next due — only a minimum can be given.`;
  } else if (!b.last.length) {
    rangeEl.textContent = `below ${fmtYr(b.hi)}`;
    explainEl.innerHTML = `No tooth has erupted yet. Next due: <b>${b.next.join(', ')}</b>.`;
  } else {
    rangeEl.textContent = fmtRange(b.lo, b.hi);
    explainEl.innerHTML = `Last erupted: <b>${b.last.join(', ')}</b> (lower bound ${fmtYr(b.lo)}). Next due: <b>${b.next.join(', ')}</b> (upper bound ${fmtYr(b.hi)}).`;
  }
  document.getElementById('age-label').textContent = learn.scrubAge.toFixed(1);
  document.getElementById('age-slider').value = learn.scrubAge;
}

/* quick-jump buttons */
document.querySelectorAll('.learn-actions button').forEach(b => {
  b.addEventListener('click', () => {
    if (b.dataset.clear !== undefined) {
      learn.marked.clear();
      learn.auto = false;
      renderLearn();
      return;
    }
    const age = parseFloat(b.dataset.age);
    if (isNaN(age)) return;
    learn.scrubAge = age;
    learn.auto = true;
    autoFill();
    renderLearn();
  });
});

/* slider — same effect as quick-jump */
document.getElementById('age-slider').addEventListener('input', e => {
  learn.scrubAge = parseFloat(e.target.value);
  learn.auto = true;
  autoFill();
  renderLearn();
});
document.getElementById('age-minus').addEventListener('click', () => {
  learn.scrubAge = Math.max(0, learn.scrubAge - 0.5);
  learn.auto = true; autoFill(); renderLearn();
});
document.getElementById('age-plus').addEventListener('click', () => {
  learn.scrubAge = Math.min(25, learn.scrubAge + 0.5);
  learn.auto = true; autoFill(); renderLearn();
});

/* tap the 3D jaw → show info about whichever tooth was hit */
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
canvas.addEventListener('pointerdown', e => {
  if (activeTab !== 'learn') return;
  ndc.x = (e.clientX / innerWidth) * 2 - 1;
  ndc.y = -(e.clientY / innerHeight) * 2 + 1;
  raycaster.setFromCamera(ndc, camera);
  const hits = raycaster.intersectObjects(scene.children, true);
  for (const h of hits) {
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
    ${isDec ? `<div class="row"><b>Sheds around:</b> ${fmtYr(d.fall)}</div>` : ''}
    <div class="row"><b>Marked:</b> ${present ? 'present' : 'absent'}</div>
    <div class="rule">${bookRule(fdi)}</div>`;
}

/* ============================================================
   PRACTICE — 5 steps, no hints until reveal
   ============================================================ */
let P = null;
function startPractice() {
  const age = pickRandomAge();
  applyAutoForPractice(age);
  P = { age, last: null, loTyped: '', next: null, hiTyped: '' };
  renderPractice();
}
function pickRandomAge() {
  const r = Math.random();
  if (r < 0.65) return +(6 + Math.random() * 8).toFixed(1);      // 6–14
  if (r < 0.85) return +(3 + Math.random() * 3).toFixed(1);      // 3–6
  if (r < 0.95) return +(14 + Math.random() * 8).toFixed(1);     // 14–22
  return +(Math.random() * 22).toFixed(1);                        // anywhere
}
function applyAutoForPractice(age) {
  for (const fdi in teeth) {
    const p = isPresent(fdi, age);
    teeth[fdi].group.visible = p;
    teeth[fdi].group.scale.setScalar(1);
  }
}
function presentSet(age) { return new Set(Object.keys(ALL).filter(f => isPresent(f, age))); }
function pendingList(age) { return Object.keys(ALL).filter(f => !isPresent(f, age)); }

function renderPractice() {
  const host = document.getElementById('practice-content');
  const present = Array.from(presentSet(P.age));
  const pending = pendingList(P.age);
  const b = computeBand(presentSet(P.age));
  const trueLo = b.last.length ? ALL[b.last[0]].range[0] : null;
  const trueHi = b.next.length ? Math.max(...b.next.map(f => ALL[f].range[1])) : null;

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
      <p>${ALL[P.last].name} is present. From memory, what is the earliest age at which this tooth can appear? That is your lower bound.</p>
      <div style="display:flex;gap:8px;align-items:center;margin-top:6px">
        <input type="number" step="0.5" id="p-lo" value="${P.loTyped}" placeholder="yr">
      </div>
    </div>` : ''}
    ${P.loTyped !== '' ? `
    <div class="step">
      <h3>Step 3 · Which tooth is next due?</h3>
      <p>Among the FDI codes not on the jaw, which erupts earliest in the book order?</p>
      <div class="fdi-pick" id="pick-next">
        ${pending.map(f => `<button data-fdi="${f}" ${P.next===f?'class="picked"':''}>${f}</button>`).join('')}
      </div>
    </div>` : ''}
    ${P.next ? `
    <div class="step">
      <h3>Step 4 · Upper bound</h3>
      <p>${ALL[P.next].name} is not yet present. What is the latest age by which it should have appeared? That is your upper bound.</p>
      <div style="display:flex;gap:8px;align-items:center;margin-top:6px">
        <input type="number" step="0.5" id="p-hi" value="${P.hiTyped}" placeholder="yr">
      </div>
    </div>` : ''}
    ${P.next && P.hiTyped !== '' ? `
    <div class="step">
      <h3>Step 5 · Confirm the range</h3>
      <button class="primary" id="p-reveal">Reveal</button>
    </div>` : ''}
    <div id="practice-result"></div>`;

  host.querySelectorAll('#pick-last button').forEach(x =>
    x.onclick = () => { P.last = x.dataset.fdi; P.loTyped = ''; P.next = null; P.hiTyped = ''; renderPractice(); });
  const lo = host.querySelector('#p-lo');
  if (lo) lo.onchange = () => { P.loTyped = lo.value; renderPractice(); };
  host.querySelectorAll('#pick-next button').forEach(x =>
    x.onclick = () => { P.next = x.dataset.fdi; P.hiTyped = ''; renderPractice(); });
  const hi = host.querySelector('#p-hi');
  if (hi) hi.onchange = () => { P.hiTyped = hi.value; renderPractice(); };

  const rev = host.querySelector('#p-reveal');
  if (rev) rev.onclick = () => {
    const loN = parseFloat(P.loTyped), hiN = parseFloat(P.hiTyped);
    const loOK = trueLo !== null && Math.abs(loN - trueLo) <= 1;
    const hiOK = trueHi !== null && Math.abs(hiN - trueHi) <= 1;
    host.querySelector('#practice-result').innerHTML = `
      <div class="result">
        <div>${loOK ? '<span class="ok">Lower bound correct.</span>' : `<span class="no">Lower bound off — the book gives <b>${fmtYr(trueLo)}</b> for ${P.last}.</span>`}</div>
        <div>${hiOK ? '<span class="ok">Upper bound correct.</span>' : `<span class="no">Upper bound off — the book gives <b>${fmtYr(trueHi)}</b> for ${P.next}.</span>`}</div>
        <div style="margin-top:6px"><b>Defensible answer:</b> <span class="range">${fmtRange(trueLo, trueHi)}</span></div>
      </div>`;
  };
}

/* ============================================================
   TEST — chart, no hints
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

const SLOTS = {
  upperR: [['18'],['17'],['16'],['55','15'],['54','14'],['53','13'],['52','12'],['51','11']],
  upperL: [['61','21'],['62','22'],['63','23'],['64','24'],['65','25'],['26'],['27'],['28']],
  lowerL: [['71','31'],['72','32'],['73','33'],['74','34'],['75','35'],['36'],['37'],['38']],
  lowerR: [['48'],['47'],['46'],['85','45'],['84','44'],['83','43'],['82','42'],['81','41']],
};
function slotPresent(slot, age) {
  for (const f of slot) if (isPresent(f, age)) return f;
  return null;
}

function renderTest() {
  const host = document.getElementById('test-content');
  const age = T.age;
  const row = slots => slots.map(s => {
    const f = slotPresent(s, age);
    return `<div class="cell ${f ? 'present' : ''}">${f || ''}</div>`;
  }).join('');
  const chart = `
    <div class="row">${row(SLOTS.upperR)}<div style="width:14px"></div>${row(SLOTS.upperL)}</div>
    <div class="row">${row(SLOTS.lowerR)}<div style="width:14px"></div>${row(SLOTS.lowerL)}</div>`;

  const present = Array.from(presentSet(age));
  const pending = pendingList(age);

  host.innerHTML = `
    <div style="font-size:0.8em;color:#bbb;margin-bottom:6px">
      <b style="color:#4ade80">Round ${T.round} of ${T.total}</b> · Score ${T.score}
    </div>
    <p style="font-size:0.78em;color:#bbb;line-height:1.45;margin:0 0 8px">
      A dental chart. Green cells show the FDI of teeth present; blank cells mean absent.
      Answer the four questions below.
    </p>
    <div class="chart">${chart}</div>
    <div class="step" style="border-top:none">
      <h3>1 · Last erupted FDI</h3>
      <div class="fdi-pick" id="pick-last">
        ${present.map(f => `<button data-fdi="${f}" ${T.last===f?'class="picked"':''}>${f}</button>`).join('')}
      </div>
      <h3 style="margin-top:10px">2 · Lower bound (yr)</h3>
      <input type="number" step="0.5" id="t-lo" value="${T.loTyped}" placeholder="from memory">
      <h3 style="margin-top:10px">3 · Next due FDI</h3>
      <div class="fdi-pick" id="pick-next">
        ${pending.map(f => `<button data-fdi="${f}" ${T.next===f?'class="picked"':''}>${f}</button>`).join('')}
      </div>
      <h3 style="margin-top:10px">4 · Upper bound (yr)</h3>
      <input type="number" step="0.5" id="t-hi" value="${T.hiTyped}" placeholder="leave blank if none">
      <button class="primary" id="t-submit" style="margin-top:10px">Submit</button>
    </div>
    <div id="test-result"></div>`;

  host.querySelectorAll('#pick-last button').forEach(x =>
    x.onclick = () => { T.last = x.dataset.fdi; renderTest(); });
  host.querySelectorAll('#pick-next button').forEach(x =>
    x.onclick = () => { T.next = x.dataset.fdi; renderTest(); });
  host.querySelector('#t-submit').onclick = () => {
    T.loTyped = document.getElementById('t-lo').value;
    T.hiTyped = document.getElementById('t-hi').value;
    submitTest();
  };
}

function submitTest() {
  const host = document.getElementById('test-result');
  const lo = T.loTyped === '' ? null : parseFloat(T.loTyped);
  const hi = T.hiTyped === '' ? null : parseFloat(T.hiTyped);
  const markedSet = presentSet(T.age);
  const b = computeBand(markedSet);
  const trueLo = b.last.length ? ALL[b.last[0]].range[0] : null;
  const trueHi = b.next.length ? Math.max(...b.next.map(f => ALL[f].range[1])) : null;

  const lastOK = b.last.includes(T.last) || (b.last.length === 0 && T.last === null);
  const nextOK = b.next.includes(T.next) || (b.next.length === 0 && T.next === null);
  const loOK = trueLo === null ? true : (lo !== null && Math.abs(lo - trueLo) <= 1);
  const hiOK = b.open ? (hi === null || hi >= trueLo + 5)
                      : (trueHi === null ? true : (hi !== null && Math.abs(hi - trueHi) <= 1));
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
        <b>Next due:</b> ${b.next.join(', ') || '—'} — you said ${T.next || '—'}<br>
        <b>Upper bound:</b> ${trueHi !== null ? fmtYr(trueHi) : '—'} — you said ${hi !== null ? hi : '—'}
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
  learn.scrubAge = 0;
  learn.auto = true;
  autoFill();
  renderLearn();
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
