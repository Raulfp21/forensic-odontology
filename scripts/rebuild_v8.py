import bpy, os
from mathutils import Matrix, Vector

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath="/workspaces/forensic-odontology/models/anatomy_backup.glb")

DEC_DIR = "/workspaces/forensic-odontology/deciduous_clean"
PERM_DIR = "/workspaces/forensic-odontology/deciduous_raw/models"
MOLAR_SIZE_FACTOR = 0.85
DECIDUOUS_TOTAL_RATIO = 0.85   # match deciduous full size to permanent (crown will look right)
ROOT_FRACTION = 0.45           # lower 45% of tooth length is "root side" (into bone)
ROOT_COMPRESS = 0.35           # compress that root region to 35% of its length

LEFT_TO_PERM = {
    "61":"21","62":"22","63":"23","64":"24","65":"25",
    "71":"31","72":"32","73":"33","74":"34","75":"35",
}
LEFT_TO_RIGHT = {
    "61":"51","62":"52","63":"53","64":"54","65":"55",
    "71":"81","72":"82","73":"83","74":"84","75":"85",
}

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

def compress_root(meshes, is_upper):
    """Compress the root-side vertices along Z by ROOT_COMPRESS."""
    # Ensure meshes are in same coordinate space
    pts = [v.co for m in meshes for v in m.data.vertices]
    zs = [p.z for p in pts]
    z_min = min(zs); z_max = max(zs); z_range = z_max - z_min
    if z_range <= 0: return
    if is_upper:
        # Crown at LOW Z, root at HIGH Z
        split = z_min + (1 - ROOT_FRACTION) * z_range
        for m in meshes:
            for v in m.data.vertices:
                if v.co.z > split:
                    v.co.z = split + (v.co.z - split) * ROOT_COMPRESS
    else:
        # Crown at HIGH Z, root at LOW Z
        split = z_min + ROOT_FRACTION * z_range
        for m in meshes:
            for v in m.data.vertices:
                if v.co.z < split:
                    v.co.z = split - (split - v.co.z) * ROOT_COMPRESS
    print(f"    root compressed: split={split:.4f}, is_upper={is_upper}")

# ---- Step 1: Replace first molars with Dundee clean ----
MOLAR_SWAPS = {
    "16": "maxillary_first_molar_with_cusp_of_carabelli.glb",
    "26": "maxillary_first_molar_with_cusp_of_carabelli.glb",
    "36": "mandibular_first_molar.glb",
    "46": "mandibular_first_molar.glb",
}
for fdi, srcfile in MOLAR_SWAPS.items():
    old = bpy.data.objects.get(f"tooth_{fdi}")
    if not old: continue
    old_meshes = collect_meshes(old)
    tgt_center = world_center(old_meshes); tgt_size = world_size(old_meshes)
    for m in old_meshes:
        if m.name in bpy.data.objects: bpy.data.objects.remove(m, do_unlink=True)
    if f"tooth_{fdi}" in bpy.data.objects:
        bpy.data.objects.remove(bpy.data.objects[f"tooth_{fdi}"], do_unlink=True)

    bpy.ops.object.select_all(action='DESELECT')
    bpy.ops.import_scene.gltf(filepath=os.path.join(PERM_DIR, srcfile))
    new_meshes = [o for o in bpy.context.selected_objects if o.type == 'MESH']
    if not new_meshes: continue
    for m in new_meshes:
        if m.parent:
            mw = m.matrix_world.copy(); m.parent = None; m.matrix_world = mw
        m.data.transform(m.matrix_world); m.matrix_world = Matrix.Identity(4)
    cur_center = world_center(new_meshes); cur_size = world_size(new_meshes)
    auto_scale = (tgt_size / cur_size) * MOLAR_SIZE_FACTOR
    M = Matrix.Translation(tgt_center) @ Matrix.Scale(auto_scale, 4) @ Matrix.Translation(-cur_center)
    for m in new_meshes:
        m.data.transform(M); m.data.materials.clear()
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
    print(f"swapped tooth_{fdi}")

# ---- Step 2: Merge deciduous with root cropping ----
targets = {}
for left, perm in LEFT_TO_PERM.items():
    p = bpy.data.objects.get(f"tooth_{perm}")
    if not p: continue
    m = collect_meshes(p)
    targets[left] = {"center": world_center(m), "size": world_size(m)}
    print(f"target tooth_{perm} ctr=({targets[left]['center'].x:.4f},{targets[left]['center'].y:.4f},{targets[left]['center'].z:.4f})")

created = {}
for fname in sorted(os.listdir(DEC_DIR)):
    if not fname.startswith('primary_') or not fname.endswith('.glb'): continue
    fdi = fname.replace('.glb','').split('_')[-1]
    if fdi not in targets: continue

    bpy.ops.object.select_all(action='DESELECT')
    bpy.ops.import_scene.gltf(filepath=os.path.join(DEC_DIR, fname))
    meshes = []
    for r in bpy.context.selected_objects: meshes.extend(collect_meshes(r))
    meshes = list({id(m): m for m in meshes}.values())
    if not meshes: continue

    for m in meshes:
        if m.parent:
            mw = m.matrix_world.copy(); m.parent = None; m.matrix_world = mw
        m.data.transform(m.matrix_world); m.matrix_world = Matrix.Identity(4)

    pts = [v.co for m in meshes for v in m.data.vertices]
    xs=[p.x for p in pts]; ys=[p.y for p in pts]; zs=[p.z for p in pts]
    c_cur = Vector(((min(xs)+max(xs))/2,(min(ys)+max(ys))/2,(min(zs)+max(zs))/2))
    s_cur = max(max(xs)-min(xs), max(ys)-min(ys), max(zs)-min(zs))

    tgt = targets[fdi]
    auto_scale = (tgt["size"] * DECIDUOUS_TOTAL_RATIO) / s_cur
    c_tgt = tgt["center"]

    # First: scale to correct overall size
    M = Matrix.Translation(c_tgt) @ Matrix.Scale(auto_scale, 4) @ Matrix.Translation(-c_cur)
    for m in meshes: m.data.transform(M); m.data.materials.clear()

    # Second: compress the root portion
    is_upper = fdi[0] in '56'
    compress_root(meshes, is_upper)

    # Now join
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
    print(f"placed tooth_{fdi}")

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

bpy.context.view_layer.update()
all_pts = []
for o in bpy.data.objects:
    if o.type == 'MESH':
        mw = o.matrix_world
        for v in o.data.vertices: all_pts.append(mw @ v.co)
xs=[p.x for p in all_pts]; ys=[p.y for p in all_pts]; zs=[p.z for p in all_pts]
print(f"\nFinal bbox: X[{min(xs):.4f},{max(xs):.4f}]  Y[{min(ys):.4f},{max(ys):.4f}]  Z[{min(zs):.4f},{max(zs):.4f}]")

OUT = "/workspaces/forensic-odontology/models/anatomy.glb"
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(
    filepath=OUT, export_format='GLB',
    use_selection=True, export_apply=True, export_yup=True,
    export_materials='NONE',
)
print(f"Exported: {OUT}")
