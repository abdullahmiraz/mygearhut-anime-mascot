# Reference research for the next Blender character

Sources read on 2026-11-21:

- Blender Studio training: https://studio.blender.org/training/ and https://studio.blender.org/welcome/
- Brandon 3D, Human Generator add-on review: https://brandon3d.com/human-generator/
- AnyGen realistic human model workflow: https://www.anygen.io/showcase/realistic-human-3d-model/index.html

## What is possible here

- Blender 5.2.3 LTS is running and the MCP connection works. Full bpy API is available.
- Built-in Blender tools: mesh and sculpt, Multiresolution, retopology, UVs, Principled BSDF with subsurface scattering, hair curves, armatures, shape keys, rendering.
- Free references can be saved as images and used on reference planes in Blender.

## What is not available here

- Human Generator add-on. It is paid and not installed. It gives base meshes, bodies, faces, skin, hair, clothes and rigs, but we cannot use it without purchase.
- Blender Studio full courses. They need a subscription (about EUR 11.50/month). Only descriptions are public.
- No free rigged realistic human GLB was found that survives a Three.js render check.

## Reference images saved

- `hg-male-base.jpg`: Human Generator male base with rig markers. Good for body proportions and joint placement.
- `hg-female-render.jpg`: finished realistic head and shoulders with short hair. Good for skin, hairline, eyes and lips.
- `hg-face-controls.jpg`: the facial feature groups Human Generator exposes (upper skull, eyes, ears, nose). Good as a checklist of what a face needs.
- `hg-poses.jpg`: pose library examples. Useful later for the movement stage, not for the first shape pass.

## Workflow agreed with Abdullah

1. Pick one reference direction and lock it. No Blender work before this.
2. Learn the shapes and depth from front, side, three-quarter and back views.
3. Build only base anatomy first: skull, rib cage, pelvis, limbs, hands, feet in A-pose. Check silhouette before detail.
4. Add secondary forms: brow, lids, nose, lips, clavicles, knees, knuckles.
5. Only then do materials, hair direction and clothing.
6. After the shape review passes, build the rig and movement.

## Review rule from the references

Fix the largest visible error first. Silhouette and proportion beat pores and textures. Approve a character only after neutral clay, material, motion and multi-light checks agree.
