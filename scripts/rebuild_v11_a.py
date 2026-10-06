import bpy, os, sys
from mathutils import Matrix, Vector

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath="/workspaces/forensic-odontology/models/anatomy_backup.glb")

DEC_DIR = "/workspaces/forensic-odontology/deciduous_clean"
PERM_DIR = "/workspaces/forensic-odontology/deciduous_raw/models"
MOLAR_SIZE_FACTOR = 0.85
DECIDUOUS_TOTAL_RATIO = 0.85
ROOT_FRACTION = 0.45
ROOT_COMPRESS = 0.20
SOCKET_BURY = 0.012   # shift entire tooth into the socket (fraction of model height)

# Which molar FDI codes need mirroring. Source GLBs from Dundee are
# side-agnostic; we assume the imported shape is anatomically "left"
# and mirror the right-hand ones. Flip this set if it looks wrong.
MIRROR_MOLARS = {"26", "46"}

LEFT_TO_PERM = {
    "61":"21","62":"22","63":"23","64":"24","65":"25",
    "71":"31","72":"32","73":"33","74":"34","75":"35",
}
LEFT_TO_RIGHT = {
    "61":"51","62":"52","63":"53","64":"54","65":"55",
    "71":"81","72":"82","73":"83","74":"84","75":"85",
}

def die(msg):
    print(f"FATAL: {msg}", file=sys.stderr)
    sys.exit(1)

def collect_meshes(obj):
    out = []
    if obj.type == 'MESH': out.append(obj)
    for ch in obj.children: out.extend(collect_meshes(ch))
    return out

def world_center(objs):
    pts = []
    for o in objs:
        if o.type != 'MESH': continue
        mw = o.matrix_world
        for v in o.data.vertices: pts.append(mw @ v.co)
    if not pts: return None
    xs=[p.x for p in pts]; ys=[p.y for p in pts]; zs=[p.z for p in pts]
    return Vector(((min(xs)+max(xs))/2,(min(ys)+max(ys))/2,(min(zs)+max(zs))/2))

def world_size(objs):
    pts = []
    for o in objs:
        if o.type != 'MESH': continue
        mw = o.matrix_world
        for v in o.data.vertices: pts.append(mw @ v.co)
    if not pts: return 0
    xs=[p.x for p in pts]; ys=[p.y for p in pts]; zs=[p.z for p in pts]
    return max(max(xs)-min(xs), max(ys)-min(ys), max(zs)-min(zs))

def world_z_range(objs):
    zs = []
    for o in objs:
        if o.type != 'MESH': continue
        mw = o.matrix_world
        for v in o.data.vertices: zs.append((mw @ v.co).z)
    if not zs: return (0,0)
    return (min(zs), max(zs))

def compress_root(meshes, is_upper):
    """Compress the root-side vertices along Z by ROOT_COMPRESS."""
    pts = [v.co for m in meshes for v in m.data.vertices]
    zs = [p.z for p in pts]
    z_min = min(zs); z_max = max(zs); z_range = z_max - z_min
    if z_range <= 0: return
    if is_upper:
        # Crown at LOW Z (points down), root at HIGH Z (into maxilla)
        split = z_min + (1 - ROOT_FRACTION) * z_range
        for m in meshes:
            for v in m.data.vertices:
                if v.co.z > split:
                    v.co.z = split + (v.co.z - split) * ROOT_COMPRESS
    else:
        # Crown at HIGH Z (points up), root at LOW Z (into mandible)
        split = z_min + ROOT_FRACTION * z_range
        for m in meshes:
            for v in m.data.vertices:
                if v.co.z < split:
                    v.co.z = split - (split - v.co.z) * ROOT_COMPRESS
    for m in meshes:
        m.data.update()

# ---- Sanity: verify Z-axis orientation with known upper/lower teeth ----
u11 = bpy.data.objects.get("tooth_11")
l31 = bpy.data.objects.get("tooth_31")
if u11 and l31:
    uz = world_z_range(collect_meshes(u11))
    lz = world_z_range(collect_meshes(l31))
    print(f"Sanity: tooth_11 Z[{uz[0]:.4f},{uz[1]:.4f}]  tooth_31 Z[{lz[0]:.4f},{lz[1]:.4f}]")
    if not (uz[0] < lz[1] and lz[0] < uz[1]):
        die("Upper/lower Z ranges overlap unexpectedly — axis assumption broken")
else:
    die("Missing tooth_11 or tooth_31 — cannot verify Z orientation")

# ---- Step 1: Replace first molars with Dundee clean ----
MOLAR_SWAPS = {
    "16": "maxillary_first_molar_with_cusp_of_carabelli.glb",
    "26": "maxillary_first_molar_with_cusp_of_carabelli.glb",
    "36": "mandibular_first_molar.glb",
    "46": "mandibular_first_molar.glb",
}
for fdi, srcfile in MOLAR_SWAPS.items():
    old = bpy.data.objects.get(f"tooth_{fdi}")
    if not old:
        print(f"WARN: tooth_{fdi} not found")
        continue
    old_meshes = collect_meshes(old)
    tgt_center = world_center(old_meshes); tgt_size = world_size(old_meshes)
    for m in old_meshes:
        if m.name in bpy.data.objects: bpy.data.objects.remove(m, do_unlink=True)
    if f"tooth_{fdi}" in bpy.data.objects:
        bpy.data.objects.remove(bpy.data.objects[f"tooth_{fdi}"], do_unlink=True)

    bpy.ops.object.select_all(action='DESELECT')
    bpy.ops.import_scene.gltf(filepath=os.path.join(PERM_DIR, srcfile))
    # Dedupe via selected_objects (fix #3)
    new_meshes = [o for o in bpy.context.selected_objects if o.type == 'MESH']
    if not new_meshes:
        die(f"no mesh imported from {srcfile}")

    for m in new_meshes:
        if m.parent:
            mw = m.matrix_world.copy(); m.parent = None; m.matrix_world = mw
        m.data.transform(m.matrix_world); m.matrix_world = Matrix.Identity(4)

    cur_center = world_center(new_meshes); cur_size = world_size(new_meshes)
    if cur_size <= 0:
        die(f"zero-size molar mesh from {srcfile}")
    auto_scale = (tgt_size / cur_size) * MOLAR_SIZE_FACTOR
    M = Matrix.Translation(tgt_center) @ Matrix.Scale(auto_scale, 4) @ Matrix.Translation(-cur_center)
    for m in new_meshes:
        m.data.transform(M); m.data.materials.clear()

    # Side correction (fix #4)
    if fdi in MIRROR_MOLARS:
        for m in new_meshes:
            for v in m.data.vertices:
                v.co.x = 2 * tgt_center.x - v.co.x
            m.data.flip_normals()
            m.data.update()
        print(f"  mirrored molar {fdi} around x={tgt_center.x:.4f}")

    bpy.ops.object.select_all(action='DESELECT')
    for m in new_meshes: m.select_set(True)
    bpy.context.view_layer.objects.active = new_meshes[0]
    if len(new_meshes) > 1: bpy.ops.object.join()
    joined = new_meshes[0]; joined.name = f"tooth_{fdi}_mesh"
    joined.data.transform(Matrix.Translation(-tgt_center))

    container = bpy.data.objects.new(f"tooth_{fdi}", None)
    container.location = tgt_center
    bpy.context.collection.objects.link(container)
    joined.parent = container
    joined.matrix_parent_inverse = Matrix.Identity(4)
    joined.matrix_basis = Matrix.Identity(4)
    print(f"swapped tooth_{fdi} (scale {auto_scale:.4f})")

# ---- Step 2: Merge deciduous with root cropping ----
targets = {}
for left, perm in LEFT_TO_PERM.items():
    p = bpy.data.objects.get(f"tooth_{perm}")
    if not p:
        die(f"missing permanent target tooth_{perm}")
    m = collect_meshes(p)
    targets[left] = {"center": world_center(m), "size": world_size(m)}

created = {}
for fname in sorted(os.listdir(DEC_DIR)):
    if not fname.startswith('primary_') or not fname.endswith('.glb'): continue
    fdi = fname.replace('.glb','').split('_')[-1]
    if fdi not in targets: continue

    bpy.ops.object.select_all(action='DESELECT')
    bpy.ops.import_scene.gltf(filepath=os.path.join(DEC_DIR, fname))
    # Dedupe via selected_objects (fix #3)
    meshes = [o for o in bpy.context.selected_objects if o.type == 'MESH']
    if not meshes:
        print(f"WARN: no mesh in {fname}")
        continue

    for m in meshes:
        if m.parent:
            mw = m.matrix_world.copy(); m.parent = None; m.matrix_world = mw
        m.data.transform(m.matrix_world); m.matrix_world = Matrix.Identity(4)

    pts = [v.co for m in meshes for v in m.data.vertices]
    xs=[p.x for p in pts]; ys=[p.y for p in pts]; zs=[p.z for p in pts]
    c_cur = Vector(((min(xs)+max(xs))/2,(min(ys)+max(ys))/2,(min(zs)+max(zs))/2))
    s_cur = max(max(xs)-min(xs), max(ys)-min(ys), max(zs)-min(zs))
    if s_cur <= 0:
        print(f"WARN: zero-size {fname}")
        continue

    tgt = targets[fdi]
    auto_scale = (tgt["size"] * DECIDUOUS_TOTAL_RATIO) / s_cur
    c_tgt = tgt["center"]

    M = Matrix.Translation(c_tgt) @ Matrix.Scale(auto_scale, 4) @ Matrix.Translation(-c_cur)
    for m in meshes:
        m.data.transform(M); m.data.materials.clear()

    is_upper = fdi[0] in '56'
    compress_root(meshes, is_upper)
    bury = SOCKET_BURY * tgt["size"]
    for m in meshes:
        for v in m.data.vertices:
            v.co.z += (1 if is_upper else -1) * bury
        m.data.update()

    bpy.ops.object.select_all(action='DESELECT')
    for m in meshes: m.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    meshes[0].matrix_world = Matrix.Identity(4)
    if len(meshes) > 1: bpy.ops.object.join()
    joined = meshes[0]
    joined.data.transform(Matrix.Translation(-c_tgt))
    joined.name = f"tooth_{fdi}_mesh"

    container = bpy.data.objects.new(f"tooth_{fdi}", None)
    container.location = c_tgt
    bpy.context.collection.objects.link(container)
    joined.parent = container
    joined.matrix_parent_inverse = Matrix.Identity(4)
    joined.matrix_basis = Matrix.Identity(4)
    created[fdi] = (container, joined)

# ---- Step 3: Mirror ----
for left_fdi, (cont, mesh) in created.items():
    right_fdi = LEFT_TO_RIGHT[left_fdi]
    new_data = mesh.data.copy()
    for v in new_data.vertices: v.co.x *= -1
    new_data.flip_normals()
    new_mesh = bpy.data.objects.new(f"tooth_{right_fdi}_mesh", new_data)
    bpy.context.collection.objects.link(new_mesh)
    new_cont = bpy.data.objects.new(f"tooth_{right_fdi}", None)
    new_cont.location = Vector((-cont.location.x, cont.location.y, cont.location.z))
    bpy.context.collection.objects.link(new_cont)
    new_mesh.parent = new_cont
    new_mesh.matrix_parent_inverse = Matrix.Identity(4)
    new_mesh.matrix_basis = Matrix.Identity(4)
    new_mesh.location = (0,0,0)

# ---- Step 4: Add real Dundee third molars ----
THIRD_MOLARS = {
    "18": "maxillary_third_molar.glb",
    "28": "maxillary_third_molar.glb",
    "38": "mandibular_third_molar.glb",
    "48": "mandibular_third_molar.glb",
}
SECOND_MOLAR = {"18": "17", "28": "27", "38": "37", "48": "47"}
MIRROR_THIRD = {"28", "48"}   # source is left-shaped; mirror the right side

for fdi, srcfile in THIRD_MOLARS.items():
    src_fdi = SECOND_MOLAR[fdi]
    src_obj = bpy.data.objects.get(f"tooth_{src_fdi}")
    if not src_obj:
        print(f"WARN: no reference tooth_{src_fdi}")
        continue
    src_meshes = collect_meshes(src_obj)
    src_center = world_center(src_meshes)
    src_size = world_size(src_meshes)

    # Target position: one tooth-width posterior (behind) and slightly inward
    is_upper = fdi[0] in '12'
    is_left = fdi in ('28', '38')
    posterior = src_size * 0.75
    inward = src_size * 0.04
    side_dir = 1 if is_left else -1
    # Arch is in X-Y plane. Posterior direction = -Y. Inward = -X for left teeth.
    first_fdi = {"18": "16", "28": "26", "38": "36", "48": "46"}[fdi]
    ref6 = bpy.data.objects.get(f"tooth_{first_fdi}")
    if not ref6:
        print(f"WARN: no reference tooth_{first_fdi}")
        continue
    c6 = world_center(collect_meshes(ref6))
    ARCH_K = float(os.environ.get("ARCH_K", "0.9"))   # 3rd-molar step as fraction of the 6->7 step
    Z_LIFT = float(os.environ.get("Z_LIFT", "0.0"))   # extra lift, in tooth-sizes
    tgt_center = src_center + (src_center - c6) * ARCH_K
    tgt_center.z += src_size * Z_LIFT
    print(f"V10 {fdi}: c6={tuple(round(v,4) for v in c6)} c7={tuple(round(v,4) for v in src_center)} tgt={tuple(round(v,4) for v in tgt_center)}")

    bpy.ops.object.select_all(action='DESELECT')
    bpy.ops.import_scene.gltf(filepath=os.path.join(PERM_DIR, srcfile))
    new_meshes = [o for o in bpy.context.selected_objects if o.type == 'MESH']
    if not new_meshes:
        print(f"WARN: no mesh from {srcfile}")
        continue

    for m in new_meshes:
        if m.parent:
            mw = m.matrix_world.copy(); m.parent = None; m.matrix_world = mw
        m.data.transform(m.matrix_world); m.matrix_world = Matrix.Identity(4)

    cur_center = world_center(new_meshes)
    cur_size = world_size(new_meshes)
    auto_scale = (src_size * 0.95) / cur_size
    M = Matrix.Translation(tgt_center) @ Matrix.Scale(auto_scale, 4) @ Matrix.Translation(-cur_center)
    for m in new_meshes:
        m.data.transform(M); m.data.materials.clear()

    if fdi in MIRROR_THIRD:
        for m in new_meshes:
            for v in m.data.vertices:
                v.co.x = 2 * tgt_center.x - v.co.x
            m.data.flip_normals()
            m.data.update()

    bpy.ops.object.select_all(action='DESELECT')
    for m in new_meshes: m.select_set(True)
    bpy.context.view_layer.objects.active = new_meshes[0]
    if len(new_meshes) > 1: bpy.ops.object.join()
    joined = new_meshes[0]; joined.name = f"tooth_{fdi}_mesh"
    joined.data.transform(Matrix.Translation(-tgt_center))

    container = bpy.data.objects.new(f"tooth_{fdi}", None)
    container.location = tgt_center
    bpy.context.collection.objects.link(container)
    joined.parent = container
    joined.matrix_parent_inverse = Matrix.Identity(4)
    joined.matrix_basis = Matrix.Identity(4)
    print(f"added tooth_{fdi} (scale {auto_scale:.4f})")

bpy.context.view_layer.update()
all_pts = []
for o in bpy.data.objects:
    if o.type == 'MESH':
        mw = o.matrix_world
        for v in o.data.vertices: all_pts.append(mw @ v.co)
xs=[p.x for p in all_pts]; ys=[p.y for p in all_pts]; zs=[p.z for p in all_pts]
print(f"\nFinal bbox: X[{min(xs):.4f},{max(xs):.4f}]  Y[{min(ys):.4f},{max(ys):.4f}]  Z[{min(zs):.4f},{max(zs):.4f}]")

# Hard sanity on bbox
if not (-0.10 < min(xs) < -0.04 and 0.04 < max(xs) < 0.10):
    die(f"X range outside expected [-0.06, 0.06]: got [{min(xs):.4f},{max(xs):.4f}]")

OUT = "/workspaces/forensic-odontology/models/anatomy_v11.glb"
bpy.ops.object.select_all(action='SELECT')
# ===== v11: replace ALL permanent teeth with permanent_dentition.glb =====
import numpy as np, math
V11_FILE = os.path.join(PERM_DIR, "permanent_dentition.glb")
V11_MIRROR = os.environ.get("MIRROR_FILE", "0") == "1"
V11_SNAP = os.environ.get("SNAP", "1") == "1"
V11_ZSHIFT = float(os.environ.get("Z_SHIFT", "0.0"))   # fraction of tooth size, + = up
UPPER_ORDER = ["18","17","16","15","14","13","12","11","21","22","23","24","25","26","27","28"]
LOWER_ORDER = ["48","47","46","45","44","43","42","41","31","32","33","34","35","36","37","38"]
if not os.path.exists(V11_FILE):
    die(f"missing {V11_FILE}")
bpy.context.view_layer.update()
prev_sel_names = [o.name for o in bpy.context.selected_objects]

def _verts(m):
    a = np.empty(len(m.data.vertices) * 3, dtype=np.float32)
    m.data.vertices.foreach_get("co", a)
    return a.reshape(-1, 3).astype(np.float64)

def _bbox(m):
    v = _verts(m)
    return (v.min(0) + v.max(0)) / 2, float((v.max(0) - v.min(0)).max())

def _vec(c):
    return Vector((float(c[0]), float(c[1]), float(c[2])))

# --- reference: current teeth (positions the bone was fitted to)
old = {}
for f in UPPER_ORDER + LOWER_ORDER:
    o = bpy.data.objects.get(f"tooth_{f}")
    if o:
        ms = collect_meshes(o)
        if ms:
            c = world_center(ms)
            old[f] = (np.array([c.x, c.y, c.z]), float(world_size(ms)))
print(f"V11 old teeth found: {len(old)}/32")

# --- import new set, bake transforms, drop junk
before = set(bpy.data.objects)
bpy.ops.object.select_all(action='DESELECT')
bpy.ops.import_scene.gltf(filepath=V11_FILE)
bpy.context.view_layer.update()
imported = [o for o in bpy.data.objects if o not in before]
empties = [o for o in imported if o.type != 'MESH']
meshes = [o for o in imported if o.type == 'MESH']
good = []
for m in meshes:
    if len(m.data.vertices) < 10:
        bpy.data.objects.remove(m, do_unlink=True)
        continue
    mw = m.matrix_world.copy(); m.parent = None; m.matrix_world = mw
    m.data.transform(m.matrix_world); m.matrix_world = Matrix.Identity(4)
    m.data.materials.clear()
    good.append(m)
for o in empties:
    bpy.data.objects.remove(o, do_unlink=True)
if V11_MIRROR:
    for m in good:
        m.data.transform(Matrix.Scale(-1, 4, Vector((1, 0, 0))))
        m.data.flip_normals(); m.data.update()

# --- assign FDI by position: split upper/lower by height, sort along X
info = [(m,) + _bbox(m) for m in good]          # (mesh, center, size)
zmed = float(np.median([i[1][2] for i in info]))
upper = sorted([i for i in info if i[1][2] > zmed], key=lambda i: i[1][0])
lower = sorted([i for i in info if i[1][2] <= zmed], key=lambda i: i[1][0])
print(f"V11 new meshes: {len(info)} (upper {len(upper)}, lower {len(lower)})")
if len(upper) != 16 or len(lower) != 16:
    die("expected 16 upper + 16 lower tooth meshes")
newt = {}
for f, i in zip(UPPER_ORDER, upper): newt[f] = i
for f, i in zip(LOWER_ORDER, lower): newt[f] = i

# --- fit each arch (uniform scale + yaw + shift) on teeth 1-7, then snap 1-7 onto old XY
def _fit(order):
    fs = [f for f in order if f[1] != "8" and f in old]
    if len(fs) < 8:
        die(f"too few reference teeth for fit: {fs}")
    za = np.array([complex(newt[f][1][0], newt[f][1][1]) for f in fs])
    zb = np.array([complex(old[f][0][0], old[f][0][1]) for f in fs])
    ma, mb = za.mean(), zb.mean()
    w = np.sum(np.conj(za - ma) * (zb - mb)) / np.sum(np.abs(za - ma) ** 2)
    s = abs(w); th = math.atan2(w.imag, w.real); t = mb - w * ma
    msz = float(np.mean([old[f][1] for f in fs]))
    zA = np.mean([newt[f][1][2] for f in fs]); zB = np.mean([old[f][0][2] for f in fs])
    tz = float(zB - s * zA + V11_ZSHIFT * msz)
    rms = math.sqrt(float(np.mean(np.abs(w * za + t - zb) ** 2)))
    return s, th, t, tz, rms, fs, msz

for name, order in (("upper", UPPER_ORDER), ("lower", LOWER_ORDER)):
    s, th, t, tz, rms, fs, msz = _fit(order)
    M = Matrix.Translation(Vector((float(t.real), float(t.imag), tz))) @ Matrix.Rotation(th, 4, "Z") @ Matrix.Scale(s, 4)
    print(f"V11 {name}: scale={s:.5f} yaw={math.degrees(th):.2f}deg fitRMS={rms:.5f} ({100*rms/msz:.1f}% of tooth size)")
    for f in order:
        m = newt[f][0]
        m.data.transform(M); m.data.update()
        if V11_SNAP and f in fs:
            c, _ = _bbox(m)
            d = old[f][0] - c
            m.data.transform(Matrix.Translation(Vector((float(d[0]), float(d[1]), 0.0))))
            m.data.update()

# --- report (d* are offsets vs the OLD tooth as % of its size; for 8s the "old" is the v10 third molar)
print("V11 fdi  src_mesh                              size_ratio  dx%   dy%   dz%")
for f in UPPER_ORDER + LOWER_ORDER:
    m = newt[f][0]; c, sz = _bbox(m)
    if f in old:
        d = (c - old[f][0]) / old[f][1] * 100
        print(f"V11 {f}   {m.name[:36]:36s} {sz/old[f][1]:6.2f}   {d[0]:5.1f} {d[1]:5.1f} {d[2]:5.1f}")
    else:
        print(f"V11 {f}   {m.name[:36]:36s}  (no old tooth)")

# --- remove ALL old permanent teeth, then build containers like the deciduous ones
def _kill(o):
    for ch in list(o.children): _kill(ch)
    bpy.data.objects.remove(o, do_unlink=True)
for f in UPPER_ORDER + LOWER_ORDER:
    o = bpy.data.objects.get(f"tooth_{f}")
    if o: _kill(o)
new_objs = []
for f in UPPER_ORDER + LOWER_ORDER:
    m = newt[f][0]
    c, _ = _bbox(m)
    m.data.transform(Matrix.Translation(-_vec(c)))
    m.name = f"tooth_{f}_mesh"
    cont = bpy.data.objects.new(f"tooth_{f}", None)
    cont.location = _vec(c)
    bpy.context.collection.objects.link(cont)
    m.parent = cont
    m.matrix_parent_inverse = Matrix.Identity(4)
    m.matrix_basis = Matrix.Identity(4)
    new_objs += [cont, m]

# --- restore export selection (previous selection + new teeth)
bpy.ops.object.select_all(action='DESELECT')
for n in prev_sel_names:
    o = bpy.data.objects.get(n)
    if o: o.select_set(True)
for o in new_objs: o.select_set(True)
print(f"V11 done: {len(new_objs)//2} permanent teeth replaced")
# ===== end v11 =====

bpy.ops.export_scene.gltf(
    filepath=OUT, export_format='GLB',
    use_selection=True, export_apply=True, export_yup=True,
    export_materials='NONE',
)
print(f"Exported: {OUT}")
