const MysteryJaw = (() => {
  const state = { active: false, revealed: false, targetAge: null, seed: null, typical: false };
  const WINDOWS = [[0.5, 2.5], [5, 9], [9, 13], [16, 22]];
  const $ = id => document.getElementById(id);
  const api = () => window.appAPI;
  const isDec = fdi => '5678'.includes(fdi[0]);

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
      #mj-typical { margin-top: 8px; padding: 8px 12px; border-radius: 8px; font-family: inherit;
        font-size: 0.78em; font-weight: 600; cursor: pointer; background: #2a1f0a; color: #f59e0b; border: 1px solid #f59e0b; }
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
  const mid = r => (r[0] + r[1]) / 2;
  const rangeOf = d => d.eruptionRange || [d.eruption - 0.3, d.eruption + 0.3];

  // What an examiner can SEE on the jaw: teeth that are through, teeth not through yet.
  // (A deciduous tooth that is absent but already emerged has been shed - it is ignored.)
  function observe(data, map, age) {
    const through = [], notYet = [];
    for (const fdi in map) {
      const d = data.deciduousTeeth[fdi] || data.permanentTeeth[fdi];
      if (!d) continue;
      const r = rangeOf(d), item = { fdi, e: mid(r), r };
      if (map[fdi].group.visible) through.push(item);
      else if (api().getEmergence(fdi) > age) notYet.push(item);
    }
    return { through, notYet };
  }

  // Textbook logic: lower bound from the last tooth through, upper bound from the next tooth due.
  function bracket(through, notYet) {
    const pick = (list, best) => {
      if (!list.length) return [];
      const e = list.reduce((m, t) => best(m, t.e), list[0].e);
      return list.filter(t => Math.abs(t.e - e) < 1e-9);
    };
    const last = pick(through, Math.max), next = pick(notYet, Math.min);
    const lo = last.length ? Math.min(...last.map(t => t.r[0])) : 0;
    const hi = next.length ? Math.max(...next.map(t => t.r[1]))
             : last.length ? Math.max(...last.map(t => t.r[1])) : 30;
    return { lo, hi, last: last.map(t => t.fdi), next: next.map(t => t.fdi) };
  }

  const isTight = (span, b) => span <= Math.max(1, (b.hi - b.lo) + 1);

  // Teeth in THIS child that fall outside the book range (emerged early / not through late).
  function oddTeeth(data, map, age) {
    const out = [];
    for (const fdi in map) {
      const d = data.deciduousTeeth[fdi] || data.permanentTeeth[fdi];
      if (!d) continue;
      const r = rangeOf(d), em = api().getEmergence(fdi), vis = map[fdi].group.visible;
      if (vis && em < r[0] - 1e-9) out.push({ dev: r[0] - em, txt: `${fdi} came through at ${fmtYr(em)} (book ${fmtRange(r[0], r[1])})` });
      else if (!vis && em > age && age >= r[1]) out.push({ dev: age - r[1] + 0.001, txt: `${fdi} is not through at ${fmtYr(age)} (book: by ${fmtYr(r[1])})` });
    }
    return out.sort((a, b) => b.dev - a.dev).slice(0, 4).map(o => o.txt);
  }

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
    const i = $('tooth-info'); if (i) i.textContent = i.textContent.replace(/\s*·\s*jaw\s*\d+%/, '').replace(/\s*·\s*\d+ in emergence range/, '');
  }

  function startNewRound() {
    state.targetAge = pickAge();
    state.seed = Math.floor(Math.random() * 2147483647);
    state.active = true; state.revealed = false; state.typical = false;
    if (api().newPerson) api().newPerson(state.seed);   // a random child, not the "typical" one
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
        <div class="mj-question"><b style="color:#f59e0b">Report a RANGE, never a single age.</b> This jaw belongs to a random child, who may be an early or late developer. Which teeth are through, which are not? Give the narrowest range the teeth can honestly support.</div>
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
    const data = api().getDentalData(), map = api().getTeethMap();
    state.revealed = true;
    setSlider(false);                   // unmask, let the student scrub afterwards
    pushAgeToApp(age);

    let dec = 0, perm = 0;              // count exactly what is drawn on the jaw
    for (const fdi in map) if (map[fdi].group.visible) (isDec(fdi) ? dec++ : perm++);

    const { through, notYet } = observe(data, map, age);
    const b = bracket(through, notYet);
    const hit = age >= lo && age <= hi;
    const bookHit = age >= b.lo && age <= b.hi;
    const verdict = !hit ? '<span class="no">Missed.</span>'
      : isTight(hi - lo, b) ? '<span class="ok">Correct and appropriately tight.</span>'
      : '<span class="near">Correct but wider than the teeth justify.</span>';
    const who = api().describePerson ? api().describePerson() : null;
    const odd = oddTeeth(data, map, age);
    const nm = list => list.length ? list.join(', ') : '—';

    $('mj-output').innerHTML = `
      <div class="mj-result">
        <div>True age: <span class="true-age">${age.toFixed(1)} yr</span> · you said ${fmtRange(lo, hi)}</div>
        <div>${verdict}</div>
        ${who ? `<div class="section"><b>This child:</b> ${who.label}.</div>` : ''}
        <div class="section"><b>On the jaw:</b> ${dec} deciduous · ${perm} permanent</div>
        <div class="section"><b>Last through:</b> ${nm(b.last)} &nbsp; <b>Next due:</b> ${nm(b.next)}</div>
        <div class="section"><b>Textbook range for this jaw:</b> ${fmtRange(b.lo, b.hi)} —
          ${bookHit ? '<span class="ok">contains the true age.</span>'
                    : '<span class="no">misses the true age.</span> This child is atypical; the method fails for some children, which is why the range is all you can promise.'}</div>
        ${odd.length ? `<div class="section"><b>Outside the book range:</b><br>${odd.join('<br>')}</div>` : ''}
        ${api().resetPerson ? '<button id="mj-typical">Show a typical child at this age</button>' : ''}
        <div class="section muted">A tooth is either through the gum or not; the book range shows how children differ in <i>when</i> it breaks through. Sex, nutrition, climate, ethnicity and endocrine disease all shift it. Counting teeth works to about 13 yr; for 14–20 yr you need third-molar development (±3 yr). Slider is unlocked: drag to see this child at other ages.</div>
      </div>`;
    const tb = $('mj-typical');
    if (tb) tb.onclick = () => {
      if (!state.typical) { api().resetPerson(); tb.textContent = 'Show this child again'; }
      else { api().newPerson(state.seed); tb.textContent = 'Show a typical child at this age'; }
      state.typical = !state.typical;
      pushAgeToApp(age);
    };
  }

  function open() {
    const map = api() && api().getTeethMap();
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
    if (api() && api().resetPerson) api().resetPerson();   // back to the typical child
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

  return { init, _t: { bracket, observe, isTight, pickAge } };
})();
window.MysteryJaw = MysteryJaw;
