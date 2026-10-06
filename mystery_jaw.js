const MysteryJaw = (() => {
  const state = { active: false, revealed: false, targetAge: null };
  const WINDOWS = [[0.5, 2.5], [5, 9], [9, 13], [16, 22]];
  const $ = id => document.getElementById(id);

  function injectStyles() {
    if ($('mj-styles')) return;
    const s = document.createElement('style');
    s.id = 'mj-styles';
    s.textContent = `
      #side-buttons #mj-btn { color: #f59e0b; }
      body.mj-active #ageSlider { visibility: hidden; }

      #mj-panel { position: fixed; left: 10px; right: 10px; top: 76px;
        max-height: 46vh; background: #0c0c0c; border: 1px solid #2a2a2a;
        border-radius: 14px; display: flex; flex-direction: column;
        z-index: 40; font-family: system-ui, sans-serif; overflow: hidden;
        box-shadow: 0 12px 32px rgba(0,0,0,0.75); }
      #mj-panel.hidden { display: none; }
      .mj-head { display: flex; justify-content: space-between; align-items: center;
        padding: 8px 12px; border-bottom: 1px solid #1a1a1a; }
      .mj-head h3 { margin: 0; font-size: 0.82em; color: #f59e0b; font-weight: 600; letter-spacing: 0.5px; }
      .mj-head button { background: none; border: none; color: #888; font-size: 1.15em; cursor: pointer; padding: 0 8px; }
      .mj-body { padding: 10px 14px; overflow: auto; }
      .mj-question { font-size: 0.78em; color: #bbb; margin-bottom: 8px; line-height: 1.4; }
      .mj-row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
      .mj-row label { font-size: 0.75em; color: #888; }
      .mj-row input { width: 60px; padding: 8px; background: #131313; color: #e8e8e8;
        border: 1px solid #262626; border-radius: 6px; font-family: inherit; font-size: 0.9em; text-align: center; }
      .mj-row button { padding: 9px 12px; border-radius: 8px; font-family: inherit;
        font-size: 0.8em; font-weight: 600; cursor: pointer; }
      #mj-reveal { background: #1a2a3e; color: #60a5fa; border: 1px solid #3b82f6; }
      #mj-next   { background: #1a2a1e; color: #4ade80; border: 1px solid #4ade80; }
      .mj-result { font-size: 0.8em; color: #d8d8d8; padding: 10px 12px; margin-top: 10px;
        background: #131313; border-left: 3px solid #f59e0b; border-radius: 0 8px 8px 0; line-height: 1.5; }
      .mj-result .true-age { color: #f59e0b; font-weight: 700; font-size: 1.15em; }
      .mj-result .ok { color: #4ade80; font-weight: 600; }
      .mj-result .near { color: #fbbf24; font-weight: 600; }
      .mj-result .no { color: #f87171; font-weight: 600; }
      .mj-result .section { margin-top: 6px; }
      .mj-result .section b { color: #888; font-weight: 500; }
      .mj-result .muted { color: #888; font-size: 0.92em; }
    `;
    document.head.appendChild(s);
  }

  function pickAge() {
    const [lo, hi] = WINDOWS[Math.floor(Math.random() * WINDOWS.length)];
    return +(lo + Math.random() * (hi - lo)).toFixed(1);
  }

  const fmtYr = v => v < 2 ? `${Math.round(v * 12)} mo` : `${+v.toFixed(1)} yr`;
  const fmtRange = (lo, hi) => `${fmtYr(lo)} – ${fmtYr(hi)}`;

  // Pure: the range the textbook logic supports for a given age.
  // last erupted tooth/teeth -> lower bound ; next tooth/teeth due -> upper bound.
  function bracket(data, age) {
    const all = [];
    for (const grp of [data.deciduousTeeth, data.permanentTeeth])
      for (const fdi in grp) {
        const d = grp[fdi];
        if (d.eruptionRange) all.push({ fdi, e: d.eruption, r: d.eruptionRange });
      }
    const erupted = all.filter(t => t.r[0] <= age);   // visible on the jaw = range has started
    const pending = all.filter(t => t.r[0] > age);
    const pick = (list, best) => {
      if (!list.length) return [];
      const e = list.reduce((m, t) => best(m, t.e), list[0].e);
      return list.filter(t => Math.abs(t.e - e) < 1e-9);
    };
    const last = pick(erupted, Math.max);
    const next = pick(pending, Math.min);
    const lo = last.length ? Math.min(...last.map(t => t.r[0])) : 0;
    const hi = next.length ? Math.max(...next.map(t => t.r[1]))
             : last.length ? Math.max(...last.map(t => t.r[1])) : 30;
    return { lo, hi, last: last.map(t => t.fdi), next: next.map(t => t.fdi) };
  }

  const isTight = (span, b) => span <= Math.max(1, (b.hi - b.lo) + 1);

  function setSlider(on) {
    const s = $('ageSlider');
    if (s) s.disabled = on;
    document.body.classList.toggle('mj-active', on);
  }
  function pushAgeToApp(age) {
    const s = $('ageSlider');
    if (!s) return;
    s.value = age;
    s.dispatchEvent(new Event('input', { bubbles: true }));
  }

  // Hide the answer even if an older main.js is cached: overwrite the labels directly.
  function maskLabels() {
    const a = $('age-value'); if (a) a.textContent = '?';
    const i = $('tooth-info'); if (i) i.textContent = i.textContent.replace(/\s*·\s*jaw\s*\d+%/, '');
  }

  function startNewRound() {
    state.targetAge = pickAge();
    state.active = true;
    state.revealed = false;
    setSlider(true);                    // mask first so labels show "?"
    pushAgeToApp(state.targetAge);
    maskLabels();
    renderPanel();
  }

  function renderPanel() {
    const panel = $('mj-panel');
    panel.classList.remove('hidden');
    panel.innerHTML = `
      <div class="mj-head">
        <h3>MYSTERY JAW — HOW OLD?</h3>
        <div><button id="mj-reset" title="Reset view">⟲</button><button id="mj-close">✕</button></div>
      </div>
      <div class="mj-body">
        <div class="mj-question"><b style="color:#f59e0b">Report a RANGE, never a single age.</b> Which teeth have erupted, which haven't? Give the narrowest range the teeth can honestly support.</div>
        <div class="mj-row">
          <label>Between</label><input type="number" inputmode="decimal" step="0.5" min="0" max="30" id="mj-lo">
          <label>and</label><input type="number" inputmode="decimal" step="0.5" min="0" max="30" id="mj-hi">
          <label>yr</label>
          <button id="mj-reveal">Reveal</button><button id="mj-next">New jaw</button>
        </div>
        <div id="mj-output"></div>
      </div>`;
    $('mj-close').onclick = close;
    $('mj-reset').onclick = () => window.resetView && window.resetView();
    $('mj-next').onclick = startNewRound;
    $('mj-reveal').onclick = () => {
      const lo = parseFloat($('mj-lo').value), hi = parseFloat($('mj-hi').value);
      if (isNaN(lo) || isNaN(hi) || lo >= hi) {
        $('mj-output').innerHTML = '<div class="mj-result"><span class="no">Give a range: the upper age must be higher than the lower. A single age is not a defensible answer.</span></div>';
        return;
      }
      reveal(lo, hi);
    };
  }

  function reveal(lo, hi) {
    const age = state.targetAge;
    const data = window.appAPI.getDentalData();
    const map = window.appAPI.getTeethMap();
    state.revealed = true;
    setSlider(false);                   // unmask, let the student scrub afterwards
    pushAgeToApp(age);

    // count exactly what is drawn on the jaw
    let dec = 0, perm = 0, erupting = 0;
    for (const fdi in map) if (map[fdi].group.visible) {
      ('5678'.includes(fdi[0]) ? dec++ : perm++);
      const d = data.deciduousTeeth[fdi] || data.permanentTeeth[fdi];
      if (d && d.eruptionRange && age < d.eruptionRange[1]) erupting++;
    }

    const b = bracket(data, age);
    const hit = age >= lo && age <= hi;
    const verdict = !hit ? '<span class="no">Missed.</span>'
      : isTight(hi - lo, b) ? '<span class="ok">Correct and appropriately tight.</span>'
      : '<span class="near">Correct but wider than the teeth justify.</span>';

    const nm = list => list.length ? list.join(', ') : '—';
    $('mj-output').innerHTML = `
      <div class="mj-result">
        <div>True age: <span class="true-age">${age.toFixed(1)} yr</span> · you said ${fmtRange(lo, hi)}</div>
        <div>${verdict}</div>
        <div class="section"><b>On the jaw:</b> ${dec} deciduous · ${perm} permanent${erupting ? ` (${erupting} still erupting)` : ''}</div>
        <div class="section"><b>Last erupted:</b> ${nm(b.last)} &nbsp; <b>Next due:</b> ${nm(b.next)}</div>
        <div class="section"><b>Defensible report:</b> ${fmtRange(b.lo, b.hi)}
          <div class="muted">Lower bound from the last tooth to erupt, upper bound from the next one due (Tables 4.8/4.9). These are population ranges, not rules: sex, nutrition, climate, ethnicity and endocrine disease shift eruption, which is why you report a range. Slider is unlocked: drag to see the neighbouring ages.</div></div>
      </div>`;
  }

  function open() {
    const map = window.appAPI && window.appAPI.getTeethMap();
    if (!map || !Object.keys(map).length) {          // model not loaded yet
      const b = $('mj-btn'); const t = b.textContent;
      b.textContent = 'Loading…'; setTimeout(() => (b.textContent = t), 1200);
      return;
    }
    if (!$('mj-panel').classList.contains('hidden')) return;
    startNewRound();
  }

  function close() {
    $('mj-panel').classList.add('hidden');
    state.active = false;
    setSlider(false);
    pushAgeToApp(state.targetAge ?? 0);
  }

  function init() {
    if (document.getElementById('mj-btn')) return;   // never create a second button
    injectStyles();
    const btn = document.createElement('button');
    btn.id = 'mj-btn';
    btn.textContent = 'Mystery Jaw';
    btn.onclick = open;
    (document.getElementById('side-buttons') || document.body).appendChild(btn);
    const panel = document.createElement('div');
    panel.id = 'mj-panel';
    panel.className = 'hidden';
    document.body.appendChild(panel);
    console.log('MysteryJaw ready');
  }

  return { init, _t: { bracket, isTight, pickAge } };
})();
window.MysteryJaw = MysteryJaw;
