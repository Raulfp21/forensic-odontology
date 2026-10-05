// FDI Chart — Learn + Test modes, textbook eruption ranges
const FDIChart = (() => {
const PERM = {
  upperR: ['18','17','16','15','14','13','12','11'],
  upperL: ['21','22','23','24','25','26','27','28'],
  lowerL: ['31','32','33','34','35','36','37','38'],
  lowerR: ['48','47','46','45','44','43','42','41'],
};
const DEC = {
  upperR: ['55','54','53','52','51'], upperL: ['61','62','63','64','65'],
  lowerL: ['71','72','73','74','75'], lowerR: ['85','84','83','82','81'],
};
const state = {
  open:false, mode:'learn', arc:'permanent', currentFDI:null,
  test:{ active:false, target:null, total:0, correct:0, locked:false }
};
function decodeFDI(fdi){
  const q=fdi[0], n=fdi[1];
  const quad={'1':'Upper Right','2':'Upper Left','3':'Lower Left','4':'Lower Right','5':'Upper Right','6':'Upper Left','7':'Lower Left','8':'Lower Right'}[q];
  const names={'1':'Central Incisor','2':'Lateral Incisor','3':'Canine','4':'First Premolar','5':'Second Premolar','6':'First Molar','7':'Second Molar','8':'Third Molar'};
  return { quadrant:quad, label:`${quad} ${names[n]||''}`.trim(), isDeciduous:'5678'.includes(q) };
}
function buildGrid(arc){
  const set = arc==='permanent' ? PERM : DEC;
  const row = (L,R) => `<div class="fdi-row"><div class="fdi-side">${L.map(f=>`<button class="fdi-cell" data-fdi="${f}">${f}</button>`).join('')}</div><div class="fdi-mid"></div><div class="fdi-side">${R.map(f=>`<button class="fdi-cell" data-fdi="${f}">${f}</button>`).join('')}</div></div>`;
  return `<div class="fdi-chart"><div class="fdi-axis"><span>Right</span><span class="fdi-axis-mid"></span><span>Left</span></div>${row(set.upperR,set.upperL)}<div class="fdi-hline"></div>${row(set.lowerR,set.lowerL)}</div>`;
}
function formatRange(d){
  if(d.eruptionRange && d.eruptionRange.length===2){
    const [lo,hi]=d.eruptionRange;
    const fmt=v => v<2 ? `${Math.round(v*12)} mo` : `${v} yr`;
    return `${fmt(lo)} – ${fmt(hi)}`;
  }
  return d.eruption!=null ? `${d.eruption} yr` : '—';
}
function renderInfo(fdi){
  const data = window.appAPI.getDentalData();
  const info = decodeFDI(fdi);
  const d = data.deciduousTeeth?.[fdi] || data.permanentTeeth?.[fdi] || {};
  const fallLine = d.fall ? `<div><b>Shedding:</b> ${d.fall} yr</div>` : '';
  return `<div class="fdi-info"><div class="fdi-info-code">${fdi}</div><div class="fdi-info-name">${info.label}</div><div class="fdi-info-grid"><div><b>Eruption:</b> ${formatRange(d)}</div>${fallLine}<div class="fdi-info-kind">${info.isDeciduous?'Deciduous':'Permanent'}</div></div></div><div class="fdi-rule"><b>Exam logic:</b> find the tooth that has <i>just erupted</i>. If the next tooth in the eruption order has <i>not</i> erupted, the age lies between their two ranges. Take the lower bound if the previous tooth recently erupted; the upper bound if the next is about to erupt.</div>`;
}
function handleClick(fdi){
  if(state.mode==='learn'){
    if(state.currentFDI) if(window.appAPI&&window.appAPI.clearHighlight)window.appAPI.clearHighlight(state.currentFDI);
    state.currentFDI=fdi;
    if(window.appAPI&&window.appAPI.highlightTooth)window.appAPI.highlightTooth(fdi,0x4ade80);
    document.querySelector('.fdi-info-host').innerHTML = renderInfo(fdi);
    return;
  }
  if(!state.test.active || state.test.locked) return;
  state.test.locked=true;
  const correct = fdi===state.test.target;
  if(correct) state.test.correct++;
  state.test.total++;
  const host = document.querySelector('.fdi-feedback-host');
  host.innerHTML = correct ? `<span class="ok">Correct — it is ${fdi}.</span>` : `<span class="no">Wrong — you picked ${fdi}; correct answer was <b>${state.test.target}</b>.</span>`;
  if(window.appAPI&&window.appAPI.clearAllHighlights)window.appAPI.clearAllHighlights();
  if(state.test.total>=10){
    setTimeout(()=>{ const pct=Math.round(100*state.test.correct/state.test.total); host.innerHTML=`<span class="score">Score ${state.test.correct}/${state.test.total} (${pct}%)</span>`; state.test.active=false; state.test.locked=false; },1200);
    return;
  }
  setTimeout(()=>{ state.test.locked=false; nextQuestion(); },1200);
}
function pickRandomVisible(){
  const teeth = window.appAPI.getTeethMap();
  const data = window.appAPI.getDentalData();
  const age = window.appAPI.getCurrentAge();
  const cand=[];
  for(const fdi in teeth){
    const d = data.deciduousTeeth?.[fdi] || data.permanentTeeth?.[fdi];
    if(!d) continue;
    if(age<d.eruption) continue;
    if(d.fall && age>=d.fall) continue;
    cand.push(fdi);
  }
  if(!cand.length) return null;
  return cand[Math.floor(Math.random()*cand.length)];
}
function nextQuestion(){
  const fdi = pickRandomVisible();
  const host = document.querySelector('.fdi-feedback-host');
  if(!fdi){ host.innerHTML=`<span class="no">No teeth visible at age ${window.appAPI.getCurrentAge().toFixed(1)}. Increase the slider.</span>`; state.test.active=false; return; }
  state.test.target=fdi;
  if(window.appAPI&&window.appAPI.clearAllHighlights)window.appAPI.clearAllHighlights();
  if(window.appAPI&&window.appAPI.highlightTooth)window.appAPI.highlightTooth(fdi,0xf59e0b);
  host.innerHTML = `Question ${state.test.total+1} of 10 · Score ${state.test.correct}/${state.test.total}`;
}
function startTest(){ state.test={active:true,target:null,total:0,correct:0,locked:false}; state.mode='test'; nextQuestion(); }
function open(){ state.open=true; if(window.__diagShow) window.__diagShow('[FDI] open'); document.getElementById('fdi-panel').classList.remove('hidden'); }
function close(){ state.open=false; document.getElementById('fdi-panel').classList.add('hidden'); if(window.appAPI&&window.appAPI.clearAllHighlights)window.appAPI.clearAllHighlights(); state.currentFDI=null; }
function injectStyles(){
  if(document.getElementById('fdi-styles')) return;
  const s=document.createElement('style'); s.id='fdi-styles';
  s.textContent=`
    #fdi-open{position:fixed;right:12px;bottom:150px;background:rgba(10,10,10,0.9);color:#60a5fa;border:1px solid #2a2a2a;border-radius:10px;padding:10px 14px;font-family:system-ui,sans-serif;font-size:0.78em;font-weight:600;cursor:pointer;z-index:30;}
    #fdi-open:active{background:rgba(96,165,250,0.15);}
    #fdi-panel{position:fixed;inset:0;background:rgba(0,0,0,0.85);display:flex;flex-direction:column;justify-content:flex-end;z-index:200;font-family:system-ui,sans-serif;}
    #fdi-panel.hidden{display:none;}
    #fdi-panel>.fdi-head,#fdi-panel>.fdi-arc,#fdi-panel>.fdi-chart-host,#fdi-panel>.fdi-info-host,#fdi-panel>.fdi-feedback-host{background:#0c0c0c;}
    #fdi-panel .fdi-head{display:flex;justify-content:space-between;align-items:center;padding:10px 12px;border-bottom:1px solid #1a1a1a;}
    #fdi-panel .fdi-head h3{margin:0;font-size:0.85em;color:#60a5fa;font-weight:600;letter-spacing:0.5px;}
    #fdi-panel .fdi-modes{display:flex;gap:6px;}
    #fdi-panel .fdi-modes button{background:#141414;color:#999;border:1px solid #262626;border-radius:6px;padding:6px 10px;font-size:0.72em;cursor:pointer;}
    #fdi-panel .fdi-modes button.active{background:#1a2a3e;color:#60a5fa;border-color:#3b82f6;}
    #fdi-panel .fdi-arc{display:flex;gap:4px;padding:0 12px 8px;}
    #fdi-panel .fdi-arc button{background:#141414;color:#888;border:1px solid #262626;border-radius:20px;padding:4px 10px;font-size:0.68em;cursor:pointer;}
    #fdi-panel .fdi-arc button.active{background:#1a2a1e;color:#4ade80;border-color:#4ade80;}
    .fdi-chart{padding:4px 8px 8px;}
    .fdi-axis{display:flex;justify-content:space-between;padding:0 4px 4px;font-size:0.65em;color:#555;}
    .fdi-axis-mid{flex:1;}
    .fdi-row{display:flex;align-items:center;gap:2px;}
    .fdi-side{display:flex;gap:2px;flex:1;justify-content:center;}
    .fdi-side:first-child{justify-content:flex-start;}
    .fdi-side:last-child{justify-content:flex-end;}
    .fdi-mid{width:2px;height:26px;background:#333;}
    .fdi-hline{height:1px;background:#222;margin:4px 8px;}
    .fdi-cell{background:#131313;color:#d0d0d0;border:1px solid #262626;border-radius:5px;min-width:26px;min-height:26px;padding:4px 5px;font-family:inherit;font-size:0.75em;cursor:pointer;}
    .fdi-cell:active{background:#222;}
    .fdi-cell.selected{background:#1a2a1e;border-color:#4ade80;color:#4ade80;}
    .fdi-info-host,.fdi-feedback-host{padding:10px 14px;border-top:1px solid #1a1a1a;min-height:46px;font-size:0.78em;color:#ccc;}
    .fdi-info{display:flex;align-items:center;gap:12px;}
    .fdi-info-code{font-size:1.6em;font-weight:700;color:#4ade80;min-width:42px;text-align:center;}
    .fdi-info-name{color:#e8e8e8;font-weight:500;}
    .fdi-info-grid{display:grid;grid-template-columns:1fr 1fr;gap:2px 14px;font-size:0.92em;color:#aaa;}
    .fdi-info-grid b{color:#888;font-weight:500;}
    .fdi-info-kind{grid-column:1/-1;font-size:0.7em;color:#666;text-transform:uppercase;letter-spacing:0.5px;margin-top:2px;}
    .fdi-rule{margin-top:10px;padding:8px 10px;background:#101820;border-left:3px solid #60a5fa;border-radius:0 6px 6px 0;font-size:0.72em;color:#a8c8e8;line-height:1.4;}
    .fdi-rule b{color:#60a5fa;font-weight:600;}
    .fdi-rule i{color:#d0d0d0;font-style:italic;}
    .fdi-feedback-host .ok{color:#4ade80;font-weight:600;}
    .fdi-feedback-host .no{color:#f87171;}
    .fdi-feedback-host .score{color:#60a5fa;font-weight:700;font-size:1.1em;}
  `;
  document.head.appendChild(s);
}
function init(){
  injectStyles();
  const openBtn=document.createElement('button'); openBtn.id='fdi-open'; openBtn.textContent='FDI Chart'; document.body.appendChild(openBtn);
  const panel=document.createElement('div'); panel.id='fdi-panel';
  panel.classList.add("hidden");
  panel.innerHTML=`<div class="fdi-head"><h3>FDI TWO-DIGIT CHART</h3><div class="fdi-modes"><button data-mode="learn" class="active">Learn</button><button data-mode="test">Test</button><button data-mode="close">✕</button></div></div><div class="fdi-arc"><button data-arc="permanent" class="active">Permanent</button><button data-arc="deciduous">Deciduous</button></div><div class="fdi-chart-host"></div><div class="fdi-info-host"></div><div class="fdi-feedback-host"></div>`;
  document.body.appendChild(panel);
  const chartHost = panel.querySelector('.fdi-chart-host');
  function rebuild(){
    chartHost.innerHTML = buildGrid(state.arc);
    chartHost.querySelectorAll('.fdi-cell').forEach(btn=>{
      btn.addEventListener('click',()=>{
        chartHost.querySelectorAll('.fdi-cell').forEach(b=>b.classList.remove('selected'));
        btn.classList.add('selected');
        handleClick(btn.dataset.fdi);
      });
    });
    document.querySelector('.fdi-info-host').innerHTML='';
    document.querySelector('.fdi-feedback-host').innerHTML='';
    if(window.appAPI&&window.appAPI.clearAllHighlights)window.appAPI.clearAllHighlights(); state.currentFDI=null;
  }
  rebuild();
  panel.querySelectorAll('.fdi-modes button').forEach(b=>{
    b.addEventListener('click',()=>{
      const m=b.dataset.mode;
      if(m==='close'){ close(); return; }
      if(m==='learn'){ state.mode='learn'; state.test.active=false; }
      if(m==='test'){ startTest(); }
      panel.querySelectorAll('.fdi-modes button').forEach(x=>x.classList.remove('active'));
      b.classList.add('active');
    });
  });
  panel.querySelectorAll('.fdi-arc button').forEach(b=>{
    b.addEventListener('click',()=>{
      state.arc=b.dataset.arc;
      panel.querySelectorAll('.fdi-arc button').forEach(x=>x.classList.remove('active'));
      b.classList.add('active'); rebuild();
    });
  });
  openBtn.addEventListener('click',()=>{ state.open ? close() : open(); });
  panel.addEventListener('click', e => { if (e.target === panel) close(); });
  if(window.__diagShow) window.__diagShow('[FDI] init done, button attached');
  console.log('FDIChart ready');
}
return { init, open, close };
})();
window.FDIChart = FDIChart;
