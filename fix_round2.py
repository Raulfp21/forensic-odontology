import re
TAG = "20261006b"

def patch(fn, pairs):
    s = open(fn).read()
    for old, new, label in pairs:
        if new in s: print("SKIP", fn, label, "(already applied)")
        elif old in s: s = s.replace(old, new, 1); print("OK  ", fn, label)
        else: print("WARN", fn, label, "- pattern not found")
    open(fn, 'w').write(s)

# ---------- 1. index.html: exactly ONE Mystery Jaw loader, cache-busting, range note ----------
s = open('index.html').read()
n0 = len(re.findall(r'MysteryJaw|mystery_jaw', s))
s = re.sub(r'<script\b[^>]*>(?:(?!</script>).)*?(?:mystery_jaw|MysteryJaw)(?:(?!</script>).)*</script>[ \t]*\n?', '', s, flags=re.S|re.I)
s = re.sub(r'<script\b[^>]*mystery_jaw[^>]*>\s*</script>[ \t]*\n?', '', s, flags=re.I)
s = s.replace('</body>', '<script type="module">\n  import "./mystery_jaw.js";\n  window.MysteryJaw.init();\n</script>\n</body>', 1)
# cache-bust every local module so phones never mix old + new files
s = re.sub(r'(\./(?:main|apstrc|fdi_chart|mystery_jaw)\.js)(?!\?)', r'\1?v=' + TAG, s)
# range reminder under the slider (always visible) + build tag for diagnosing stale caches
if 'id="range-note"' not in s:
    s = re.sub(r'(<span id="age-value">[^<]*</span>\s*</div>)',
               r'\1\n    <div id="range-note">Teeth erupt across a <b>range</b> of ages, never on one date. People vary, so always report a range.</div>', s, count=1)
if '#range-note' not in s:
    s = s.replace('</style>', '    #range-note { margin-top: 8px; font-size: 0.72em; color: #f59e0b; line-height: 1.35; }\n    #range-note b { color: #fbbf24; }\n    #build-tag { color: #555; }\n  </style>', 1)
if 'id="build-tag"' not in s:
    s = s.replace('<p>Age Estimation Simulator</p>', '<p>Age Estimation Simulator · <span id="build-tag">build ' + TAG + '</span></p>', 1)
open('index.html', 'w').write(s)
print("index.html: MysteryJaw refs", n0, "->", len(re.findall(r'MysteryJaw\.init', s)), "init call(s)")

# ---------- 2. main.js: stale-proof data fetch, range-first hint ----------
patch('main.js', [
 ("fetch('./data.json')", "fetch('./data.json?v=" + TAG + "')", "cache-bust data.json"),
 ("hint.textContent = 'Drag the age slider to watch teeth erupt';",
  "hint.textContent = 'Teeth erupt across a RANGE of ages, not one date. Drag the slider.';\n"
  "  Object.assign(hint.style, { top: '92px', bottom: 'auto', left: '12px', transform: 'none', maxWidth: 'calc(100vw - 150px)', whiteSpace: 'normal', textAlign: 'left' });",
  "range-first hint (top-left, wraps)"),
])

# ---------- 3. mystery_jaw.js: one button only, stale-proof masking, range emphasis ----------
patch('mystery_jaw.js', [
 ("  function init() {\n    injectStyles();",
  "  function init() {\n    if (document.getElementById('mj-btn')) return;   // never create a second button\n    injectStyles();",
  "init is idempotent"),
 ("  function startNewRound() {",
  "  // Hide the answer even if an older main.js is cached: overwrite the labels directly.\n"
  "  function maskLabels() {\n"
  "    const a = $('age-value'); if (a) a.textContent = '?';\n"
  "    const i = $('tooth-info'); if (i) i.textContent = i.textContent.replace(/\\s*·\\s*jaw\\s*\\d+%/, '');\n"
  "  }\n\n  function startNewRound() {",
  "stale-proof masking helper"),
 ("    pushAgeToApp(state.targetAge);\n    renderPanel();",
  "    pushAgeToApp(state.targetAge);\n    maskLabels();\n    renderPanel();",
  "apply masking each round"),
 ("<div class=\"mj-question\">Which teeth have erupted, which haven't? Report the age range you would put in a certificate.</div>",
  "<div class=\"mj-question\"><b style=\"color:#f59e0b\">Report a RANGE, never a single age.</b> Which teeth have erupted, which haven't? Give the narrowest range the teeth can honestly support.</div>",
  "range-first instruction"),
 ("if (isNaN(lo) || isNaN(hi) || lo > hi) {", "if (isNaN(lo) || isNaN(hi) || lo >= hi) {", "reject single-age answers"),
 ("Enter a valid range (lower ≤ upper).",
  "Give a range: the upper age must be higher than the lower. A single age is not a defensible answer.",
  "single-age message"),
])
