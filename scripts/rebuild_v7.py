import bpy, os
from mathutils import Matrix, Vector

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath="/workspaces/forensic-odontology/models/anatomy_backup.glb")

DEC_DIR = "/workspaces/forensic-odontology/deciduous_clean"
PERM_DIR = "/workspaces/forensic-odontology/deciduous_raw/models"
DECIDUOUS_RATIO = 0.65
MOLAR_SIZE_FACTOR = 0.85

MOLAR_SWAPS = {
    "16": "maxillary_first_molar_with_cusp_of_carabelli.glb",
    "26": "maxillary_first_molar_with_cusp_of_carabelli.glb",
    "36": "mandibular_first_molar.glb",
    "46": "mandibular_first_molar.glb",
}

def collect_meshes(obj):
    out = []
    if obj.type == 'MESH':
        out.append(obj)
    for ch in obj.children:
        out.extend(collect_meshes(ch))
    return out

def world_center(objs):
    pts = []
    for o in objs:
        if o.type != 'MESH': continue
        mw = o.matrix_world
        for v in o.data.vertices:
            pts.append(mw @ v.co)
    if not pts: return None
    xs = [p.x for p in pts]; ys = [p.y for p in pts]; zs = [p.z for p in pts]
    return Vector(((min(xs)+max(xs))/2, (min(ys)+max(ys))/2, (min(zs)+max(zs))/2))

def world_size(objs):
    pts = []
    for o in objs:
        if o.type != 'MESH': continue
        mw = o.matrix_world
        for v in o.data.vertices:
            pts.append(mw @ v.co)
    if not pts: return 0
    xs = [p.x for p in pts]; ys = [p.y for p in pts]; zs = [p.z for p in pts]
    return max(max(xs)-min(xs), max(ys)-min(ys), max(zs)-min(zs))

# ---- Step 1: Replace first molars with Dundee clean versions ----
for fdi, srcfile in MOLAR_SWAPS.items():
    old = bpy.data.objects.get(f"tooth_{fdi}")
    if not old:
        print(f"WARN: tooth_{fdi} not found, skipping")
        continue

    old_meshes = collect_meshes(old)
    tgt_center = world_center(old_meshes)
    tgt_size = world_size(old_meshes)

    # Capture names before removal (references become invalid after remove)
    old_container_name = f"tooth_{fdi}"
    mesh_names = [m.name for m in old_meshes]

    for mname in mesh_names:
        obj = bpy.data.objects.get(mname)
        if obj:
            bpy.data.objects.remove(obj, do_unlink=True)
    cont = bpy.data.objects.get(old_container_name)
    if cont:
        bpy.data.objects.remove(cont, do_unlink=True)

    bpy.ops.object.select_all(action='DESELECT')
    bpy.ops.import_scene.gltf(filepath=os.path.join(PERM_DIR, srcfile))
    new_meshes = [o for o in bpy.context.selected_objects if o.type == 'MESH']
    if not new_meshes:
        print(f"WARN: no mesh in {srcfile}")
        continue

    # Unparent + bake
    for m in new_meshes:
        if m.parent:
            mw = m.matrix_world.copy()
            m.parent = None
            m.matrix_world = mw
        m.data.transform(m.matrix_world)
        m.matrix_world = Matrix.Identity(4)

    cur_center = world_center(new_meshes)
    cur_size = world_size(new_meshes)
    auto_scale = (tgt_size / cur_size) * MOLAR_SIZE_FACTOR

    M = Matrix.Translation(tgt_center) @ Matrix.Scale(auto_scale, 4) @ Matrix.Translation(-cur_center)
    for m in new_meshes:
        m.data.transform(M)
        m.data.materials.clear()

    # Join
    bpy.ops.object.select_all(action='DESELECT')
    for m in new_meshes:
        m.select_set(True)
    bpy.context.view_layer.objects.active = new_meshes[0]
    if len(new_meshes) > 1:
        bpy.ops.object.join()
    joined = new_meshes[0]
    joined.name = f"tooth_{fdi}_mesh"

    # Re-bake into container
    joined.data.transform(Matrix.Translation(-tgt_center))
    container = bpy.data.objects.new(f"tooth_{fdi}", None)
    container.location = tgt_center
    bpy.context.collection.objects.link(container)
    joined.parent = container
    joined.matrix_parent_inverse = Matrix.Identity(4)
    joined.matrix_basis = Matrix.Identity(4)

    print(f"swapped tooth_{fdi} with {srcfile} (scale {auto_scale:.4f})")

# ---- Step 2: Re-merge deciduous with smaller scale ----
LEFT_TO_PERM = {
    "61":"21","62":"22","63":"23","64":"24","65":"25",
    "71":"31","72":"32","73":"33","74":"34","75":"35",
}
LEFT_TO_RIGHT = {
    "61":"51","62":"52","63":"53","64":"54","65":"55",
    "71":"81","72":"82","73":"83","74":"84","75":"85",
}

targets = {}
for left, perm in LEFT_TO_PERM.items():
    p = bpy.data.objects.get(f"tooth_{perm}")
    if not p: continue
    m = collect_meshes(p)
    targets[left] = {"center": world_center(m), "size": world_size(m)}
    print(f"target tooth_{perm} ctr=({targets[left]['center'].x:.4f},{targets[left]['center'].y:.4f},{targets[left]['center'].z:.4f})")

created = {}
for fname in sorted(os.listdir(DEC_DIR)):
    if not fname.startswith('primary_') or not fname.endswith('.glb'):
        continue
    fdi = fname.replace('.glb','').split('_')[-1]
    if fdi not in targets:
        continue

    bpy.ops.object.select_all(action='DESELECT')
    bpy.ops.import_scene.gltf(filepath=os.path.join(DEC_DIR, fname))
    meshes = []
    for r in bpy.context.selected_objects:
        meshes.extend(collect_meshes(r))
    meshes = list({id(m): m for m in meshes}.values())
    if not meshes: continue

    for m in meshes:
        if m.parent:
            mw = m.matrix_world.copy()
            m.parent = None
            m.matrix_world = mw
        m.data.transform(m.matrix_world)
        m.matrix_world = Matrix.Identity(4)

    pts = [v.co for m in meshes for v in m.data.vertices]
    xs = [p.x for p in pts]; ys = [p.y for p in pts]; zs = [p.z for p in pts]
    c_cur = Vector(((min(xs)+max(xs))/2, (min(ys)+max(ys))/2, (min(zs)+max(zs))/2))
    s_cur = max(max(xs)-min(xs), max(ys)-min(ys), max(zs)-min(zs))

    tgt = targets[fdi]
    auto_scale = (tgt["size"] * DECIDUOUS_RATIO) / s_cur
    c_tgt = tgt["center"]

    M = Matrix.Translation(c_tgt) @ Matrix.Scale(auto_scale, 4) @ Matrix.Translation(-c_cur)
    for m in meshes:
        m.data.transform(M)
        m.data.materials.clear()

    bpy.ops.object.select_all(action='DESELECT')
    for m in meshes:
        m.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    meshes[0].matrix_world = Matrix.Identity(4)
    if len(meshes) > 1:
        bpy.ops.object.join()
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

for left_fdi, (cont, mesh) in created.items():
    right_fdi = LEFT_TO_RIGHT[left_fdi]
    new_data = mesh.data.copy()
    for v in new_data.vertices:
        v.co.x *= -1
    new_data.flip_normals()
    new_mesh = bpy.data.objects.new(f"tooth_{right_fdi}_mesh", new_data)
    bpy.context.collection.objects.link(new_mesh)
    new_cont = bpy.data.objects.new(f"tooth_{right_fdi}", None)
    new_cont.location = Vector((-cont.location.x, cont.location.y, cont.location.z))
    bpy.context.collection.objects.link(new_cont)
    new_mesh.parent = new_cont
    new_mesh.matrix_parent_inverse = Matrix.Identity(4)
    new_mesh.matrix_basis = Matrix.Identity(4)
    new_mesh.location = (0, 0, 0)

bpy.context.view_layer.update()

all_pts = []
for o in bpy.data.objects:
    if o.type == 'MESH':
        mw = o.matrix_world
        for v in o.data.vertices:
            all_pts.append(mw @ v.co)
xs = [p.x for p in all_pts]; ys = [p.y for p in all_pts]; zs = [p.z for p in all_pts]
print(f"\nFinal bbox: X[{min(xs):.3f},{max(xs):.3f}]  Y[{min(ys):.3f},{max(ys):.3f}]  Z[{min(zs):.3f},{max(zs):.3f}]")

OUT = "/workspaces/forensic-odontology/models/anatomy.glb"
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(
    filepath=OUT, export_format='GLB',
    use_selection=True, export_apply=True, export_yup=True,
    export_materials='NONE',
)
print(f"Exported: {OUT}")
