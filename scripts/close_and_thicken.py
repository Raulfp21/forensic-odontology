import bpy, os
from mathutils import Matrix, Vector

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath="/workspaces/forensic-odontology/models/anatomy.glb")

# ---- Parameters you can tune ----
MANDIBLE_ROT_DEGREES = -5.0   # negative closes the jaw; try -3 to -8
SOLIDIFY_THICKNESS = 0.0006   # 0.6 mm in model units

# ---- 1. Rotate the Mandible slightly closed ----
mand = bpy.data.objects.get("Mandible")
if mand:
    # Pivot around the mandible's current center to rotate in place
    center = Vector(mand.matrix_world.translation)
    rot = Matrix.Rotation(MANDIBLE_ROT_DEGREES * 3.14159/180.0, 4, 'X')
    mand.matrix_world = Matrix.Translation(center) @ rot @ Matrix.Translation(-center) @ mand.matrix_world
    print(f"Rotated Mandible by {MANDIBLE_ROT_DEGREES} degrees around X")
else:
    print("WARN: Mandible not found")

# ---- 2. Add Solidify to bone meshes ----
# Solidify adds a back-face so the shell reads as solid volume
bone_names = ["Mandible", "Maxilla.l", "Maxilla.r"]
for name in bone_names:
    obj = bpy.data.objects.get(name)
    if not obj or obj.type != 'MESH':
        # Some models have these as parent empties with mesh children
        # Walk children and apply to any mesh
        continue

# Find the actual meshes under these names (they may be nested)
def collect_meshes_under(parent_name):
    parent = bpy.data.objects.get(parent_name)
    if not parent:
        return []
    out = []
    def walk(o):
        if o.type == 'MESH':
            out.append(o)
        for ch in o.children:
            walk(ch)
    walk(parent)
    return out

all_bone_meshes = []
for name in bone_names:
    all_bone_meshes.extend(collect_meshes_under(name))

# Deduplicate
all_bone_meshes = list({id(m): m for m in all_bone_meshes}.values())

if not all_bone_meshes:
    print("WARN: no bone meshes found")

for m in all_bone_meshes:
    # Remove any existing solidify first
    for mod in list(m.modifiers):
        if mod.type == 'SOLIDIFY':
            m.modifiers.remove(mod)
    mod = m.modifiers.new("Thicken", 'SOLIDIFY')
    mod.thickness = SOLIDIFY_THICKNESS
    mod.offset = -1.0   # extrude inward only
    mod.use_rim = True
    mod.use_rim_only = False
    print(f"Added Solidify to {m.name}")

# Apply modifiers so export bakes them
bpy.context.view_layer.update()
for m in all_bone_meshes:
    bpy.context.view_layer.objects.active = m
    m.select_set(True)
    for mod in list(m.modifiers):
        try:
            bpy.ops.object.modifier_apply(modifier=mod.name)
        except Exception as e:
            print(f"  modifier apply failed on {m.name}: {e}")
    m.select_set(False)

# ---- 3. Report final bbox ----
bpy.context.view_layer.update()
all_pts = []
for o in bpy.data.objects:
    if o.type == 'MESH':
        mw = o.matrix_world
        for v in o.data.vertices:
            all_pts.append(mw @ v.co)
xs = [p.x for p in all_pts]; ys = [p.y for p in all_pts]; zs = [p.z for p in all_pts]
print(f"\nFinal bbox: X[{min(xs):.4f},{max(xs):.4f}]  Y[{min(ys):.4f},{max(ys):.4f}]  Z[{min(zs):.4f},{max(zs):.4f}]")

# ---- 4. Export ----
OUT = "/workspaces/forensic-odontology/models/anatomy.glb"
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(
    filepath=OUT, export_format='GLB',
    use_selection=True, export_apply=True, export_yup=True,
    export_materials='NONE',
)
print(f"Exported: {OUT}")
