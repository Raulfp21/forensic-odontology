import bpy, os
from mathutils import Matrix, Vector

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath="/workspaces/forensic-odontology/models/anatomy_backup.glb")

DEC_DIR = "/workspaces/forensic-odontology/deciduous_clean"
DECIDUOUS_RATIO = 0.75  # deciduous tooth is 75% of permanent size

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
    """Return (center, max_dimension) in world space."""
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

# ----- Cache permanent tooth center + size -----
targets = {}  # left_fdi -> {'center': Vector, 'size': float}
for left, perm in LEFT_TO_PERM.items():
    perm_obj = bpy.data.objects.get(f"tooth_{perm}")
    if not perm_obj:
        print(f"WARN missing tooth_{perm}")
        continue
    c, s = world_bbox(collect_meshes(perm_obj))
    targets[left] = {'center': c, 'size': s}
    print(f"tooth_{perm} center=({c.x:.4f},{c.y:.4f},{c.z:.4f}) size={s:.4f}")

created = {}

for fname in sorted(os.listdir(DEC_DIR)):
    if not fname.startswith('primary_') or not fname.endswith('.glb'):
        continue
    fdi = fname.replace('.glb','').split('_')[-1]
    if fdi not in targets:
        continue

    bpy.ops.object.select_all(action='DESELECT')
    bpy.ops.import_scene.gltf(filepath=os.path.join(DEC_DIR, fname))

    # Collect ALL mesh descendants of the newly imported objects
    imported_roots = [o for o in bpy.context.selected_objects]
    meshes = []
    for r in imported_roots:
        meshes.extend(collect_meshes(r))
    # Dedupe
    meshes = list({id(m): m for m in meshes}.values())
    if not meshes:
        print(f"WARN no mesh {fname}")
        continue

    # 1. Unparent keeping world transform
    for m in meshes:
        if m.parent:
            mw = m.matrix_world.copy()
            m.parent = None
            m.matrix_world = mw

    # 2. Bake world matrix into vertex data, reset to identity
    for m in meshes:
        m.data.transform(m.matrix_world)
        m.matrix_world = Matrix.Identity(4)

    # 3. Measure current center + size
    pts = []
    for m in meshes:
        for v in m.data.vertices:
            pts.append(v.co)
    xs = [p.x for p in pts]; ys = [p.y for p in pts]; zs = [p.z for p in pts]
    c_cur = Vector(((min(xs)+max(xs))/2, (min(ys)+max(ys))/2, (min(zs)+max(zs))/2))
    s_cur = max(max(xs)-min(xs), max(ys)-min(ys), max(zs)-min(zs))

    # 4. Compute scale to match the permanent tooth's size
    target = targets[fdi]
    if s_cur <= 0:
        print(f"WARN zero size {fname}")
        continue
    auto_scale = (target['size'] * DECIDUOUS_RATIO) / s_cur
    c_tgt = target['center']

    print(f"  {fdi}: cur_center=({c_cur.x:.3f},{c_cur.y:.3f},{c_cur.z:.3f}) size={s_cur:.4f}  -> auto_scale={auto_scale:.6f}")

    # 5. Apply M = T(c_tgt) @ S(auto_scale) @ T(-c_cur)
    M = Matrix.Translation(c_tgt) @ Matrix.Scale(auto_scale, 4) @ Matrix.Translation(-c_cur)
    for m in meshes:
        m.data.transform(M)

    # 6. Join sub-meshes
    bpy.ops.object.select_all(action='DESELECT')
    for m in meshes:
        m.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    meshes[0].matrix_world = Matrix.Identity(4)
    if len(meshes) > 1:
        bpy.ops.object.join()
    joined = meshes[0]

    # 7. Re-bake to subtract target center so container holds position
    joined.data.transform(Matrix.Translation(-c_tgt))

    # 8. Container at target
    container = bpy.data.objects.new(f"tooth_{fdi}", None)
    container.location = c_tgt
    bpy.context.collection.objects.link(container)

    joined.parent = container
    joined.matrix_parent_inverse = Matrix.Identity(4)
    joined.matrix_basis = Matrix.Identity(4)

    created[fdi] = (container, joined)
    print(f"  placed tooth_{fdi}")

# ----- Mirror to right side -----
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

    print(f"mirrored tooth_{left_fdi} -> tooth_{right_fdi}")

# ----- Final report -----
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
