import bpy, os
from mathutils import Matrix, Vector

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath="/workspaces/forensic-odontology/models/anatomy_backup.glb")

DEC_DIR = "/workspaces/forensic-odontology/deciduous_clean"
DECIDUOUS_RATIO = 0.75

LEFT_TO_PERM = {
    "61": "21", "62": "22", "63": "23", "64": "24", "65": "25",
    "71": "31", "72": "32", "73": "33", "74": "34", "75": "35",
}
LEFT_TO_RIGHT = {
    "61": "51", "62": "52", "63": "53", "64": "54", "65": "55",
    "71": "81", "72": "82", "73": "83", "74": "84", "75": "85",
}

def collect_meshes(obj):
    out = []
    if obj.type == 'MESH':
        out.append(obj)
    for ch in obj.children:
        out.extend(collect_meshes(ch))
    return out

def world_bbox(objs):
    pts = []
    for o in objs:
        if o.type != 'MESH':
            continue
        mw = o.matrix_world
        for v in o.data.vertices:
            pts.append(mw @ v.co)
    if not pts:
        return None, 0
    xs = [p.x for p in pts]; ys = [p.y for p in pts]; zs = [p.z for p in pts]
    c = Vector(((min(xs)+max(xs))/2, (min(ys)+max(ys))/2, (min(zs)+max(zs))/2))
    s = max(max(xs)-min(xs), max(ys)-min(ys), max(zs)-min(zs))
    return c, s

# Cache permanent tooth target sizes
targets = {}
for left, perm in LEFT_TO_PERM.items():
    perm_obj = bpy.data.objects.get(f"tooth_{perm}")
    if not perm_obj:
        print(f"WARN missing tooth_{perm}")
        continue
    c, s = world_bbox(collect_meshes(perm_obj))
    targets[left] = {'center': c, 'size': s}
    print(f"tooth_{perm} ctr=({c.x:.4f},{c.y:.4f},{c.z:.4f}) sz={s:.4f}")

created = {}
for fname in sorted(os.listdir(DEC_DIR)):
    if not fname.startswith('primary_') or not fname.endswith('.glb'):
        continue
    fdi = fname.replace('.glb','').split('_')[-1]
    if fdi not in targets:
        continue

    bpy.ops.object.select_all(action='DESELECT')
    bpy.ops.import_scene.gltf(filepath=os.path.join(DEC_DIR, fname))

    imported_roots = list(bpy.context.selected_objects)
    meshes = []
    for r in imported_roots:
        meshes.extend(collect_meshes(r))
    meshes = list({id(m): m for m in meshes}.values())
    if not meshes:
        print(f"WARN no mesh {fname}")
        continue

    for m in meshes:
        if m.parent:
            mw = m.matrix_world.copy()
            m.parent = None
            m.matrix_world = mw

    for m in meshes:
        m.data.transform(m.matrix_world)
        m.matrix_world = Matrix.Identity(4)

    pts = [v.co for m in meshes for v in m.data.vertices]
    xs = [p.x for p in pts]; ys = [p.y for p in pts]; zs = [p.z for p in pts]
    c_cur = Vector(((min(xs)+max(xs))/2, (min(ys)+max(ys))/2, (min(zs)+max(zs))/2))
    s_cur = max(max(xs)-min(xs), max(ys)-min(ys), max(zs)-min(zs))

    target = targets[fdi]
    auto_scale = (target['size'] * DECIDUOUS_RATIO) / s_cur
    c_tgt = target['center']

    M = Matrix.Translation(c_tgt) @ Matrix.Scale(auto_scale, 4) @ Matrix.Translation(-c_cur)
    for m in meshes:
        m.data.transform(M)

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

# Mirror
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

# ----- DIAGNOSTIC: report any mesh with center Z < 1.0 -----
print("\n--- Mesh bbox report ---")
to_delete = []
for o in bpy.data.objects:
    if o.type != 'MESH':
        continue
    zs = [(o.matrix_world @ v.co).z for v in o.data.vertices]
    zc = (min(zs) + max(zs)) / 2
    flag = ""
    if zc < 1.0:
        flag = "  << STRAY"
        to_delete.append(o)
    print(f"  {o.name:35s} Z[{min(zs):.3f},{max(zs):.3f}]  center={zc:.3f}{flag}")

# Remove strays
for o in to_delete:
    print(f"Deleting stray: {o.name}")
    bpy.data.objects.remove(o, do_unlink=True)

# Final bbox after cleanup
all_pts = []
for o in bpy.data.objects:
    if o.type == 'MESH':
        mw = o.matrix_world
        for v in o.data.vertices:
            all_pts.append(mw @ v.co)
xs = [p.x for p in all_pts]; ys = [p.y for p in all_pts]; zs = [p.z for p in all_pts]
print(f"\nFinal bbox: X[{min(xs):.3f},{max(xs):.3f}]  Y[{min(ys):.3f},{max(ys):.3f}]  Z[{min(zs):.3f},{max(zs):.3f}]")

n = sum(1 for o in bpy.data.objects if o.type == 'EMPTY' and o.name.startswith('tooth_'))
print(f"Total tooth containers: {n}")

OUT = "/workspaces/forensic-odontology/models/anatomy.glb"
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(
    filepath=OUT, export_format='GLB',
    use_selection=True, export_apply=True, export_yup=True,
    export_materials='NONE',
)
print(f"Exported: {OUT}")
