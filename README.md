# MyGearHut 3D Mascot

A stylized, human-shaped explainer character built with Three.js. Runs locally in the browser, needs no external model files, and exposes a small API so a recorder or browser automation can drive gestures and speech.

Status: local build only. Nothing is deployed, posted, or published. That still needs Abdullah's explicit approval.

Git restore points:
- `v1-threejs-before-blender` (tag and branch) points to commit `3f7eb38`, the first Three.js-only mascot before any Blender experiments. Three.js is pinned to `0.187.0` in `package.json`.
- `master` is the latest working version.
- To return to the first variant: `git checkout v1-threejs-before-blender`. To come back: `git checkout master`.
- All commits are local. No remote was added and nothing was pushed.

## Research done before building

Web search was unavailable in this session, so search results were fetched from DuckDuckGo HTML and the source pages were read directly.

- ContentBeta, "15 Best 3D Explainer Videos to Inspire You in 2026", updated 24 Sep 2026: https://www.contentbeta.com/blog/3d-explainer-videos/
- Explainer Video Production, "Create 3D Explainer Video Characters", 20 May 2025: https://explainervideoproduction.com/create-3d-explainer-video-characters/
- Three.js examples and docs: https://threejs.org/examples/
- Three.js `LatheGeometry`, `ExtrudeGeometry`, `CatmullRomCurve3` and `TubeGeometry` docs: https://threejs.org/docs/pages/LatheGeometry.html , https://threejs.org/docs/pages/ExtrudeGeometry.html , https://threejs.org/docs/pages/CatmullRomCurve3.html , https://threejs.org/docs/pages/TubeGeometry.html
- Stylized 3D hair for Three.js, img2threejs grimoire: https://github.com/img2threejs/img2threejs/blob/main/grimoire/character/stylized_hair_threejs.md . Its guidance on rooted clumps,eye clearance and silhouette review drove the hair rework.

What the sources agree on:

- 3D explainer videos are still a strong format in 2026 for tech and SaaS, usually short and built around one clear message.
- Recurring visual traits: rounded shapes, soft controlled motion, subtle lighting, soft shadows, minimal backgrounds, consistent depth. Clarity beats detail.
- Character guidance: decide the mascot's role and tone first, match the palette to the brand, keep gestures natural so the character does not distract, and reuse the character across videos.
- Traditional production uses Blender, Character Creator or similar, with real cost and turnaround. A code-built Three.js character gives MyGearHut a lightweight reusable presenter that can be animated from a script.

Fit with the existing channel plan: the video scan in CONTEXT.md found computer science and math explainers beat AI news about 2 to 1, and a "famous code trick explained" 30 to 60 second format was recommended but not yet adopted. This mascot is built for that kind of short explainer and the 60-Second Drop, not for news reading.

## Design decisions

- Stylized, not realistic. The earlier Blender mascot in `../video-generation/mascot-blender/` is more realistic and reads as uncanny at close range. Rounded, simplified geometry avoids the uncanny valley and is cheaper to animate.
- Slightly large head, simple face, glasses as a nod to the existing mascot, smile by default. Friendly and neutral across Bangla and English versions.
- Brand accent `#22C55E` on the hoodie, sole, side stripe and floor rings. Rim light is neutral blue so it does not dye the hair green. Dark navy background by default.
- Everything is procedural geometry. No GLTF, texture, font or HDR file can go missing.
- Joint hierarchy with pivots at shoulder, elbow, hip and knee. Limb segments hang down the local -Y axis so gestures are just rotations.
- Neck rises out of the collar with the head sitting above it, so the figure no longer reads as a bobblehead. Camera targets were raised to match.
- Hoodie built as a lathed torso with a hood tucked behind the neck, ribbed hem and cuffs, drawstrings on Catmull-Rom curves, and a kangaroo pocket.
- Hands have four tapered, fanned fingers plus a thumb with a thenar mound. Each finger has three joints with per-finger curl, so "point" extends the index and folds the rest.
- Shoes are layered sneakers with rubber sole, midsole, toe cap, tongue, laces and an accent stripe.
- Hair is one sculpted mesh: a sphere cap displaced with broad waves, a side part and two soft bangs. Tapered Frenet ribbons and separate capsule clumps were both tried and rejected because they read as strips or blobs at this short length.
- Three-point lighting plus a front fill for the face, soft shadows, ACES tone mapping and capped pixel ratio for stable quality.
- Idle breathing, sway, irregular blinking, six gestures and a talk mode with a smile to open-mouth crossfade.

## Run

```bash
npm install
npm run dev
```

Open http://127.0.0.1:5173/

```bash
npm run check   # production build + rig math check
```

## Anime variant

Open [the anime variant](http://127.0.0.1:5173/anime.html) from the dev server or follow the **Anime variant** link in the original viewer. The production build includes both pages.

The anime viewer exposes `window.animeMascot` after `mascot:ready`. Use `state(name)` with `idle`, `thinking`, `speaking`, `waving` or `error`. The other methods are `frame(name)`, `background(mode)`, `ui(show)`, `blink()` and `captureFrame()`.

For a clean three-quarter capture, use `/anime.html?ui=0&frame=medium&yaw=20&bg=transparent`. Use `state=speaking` or `state=waving` to start in that pose.

## Controls

Drag to orbit, scroll to zoom. Buttons cover gesture, talk, framing, background and orbit.

Keyboard: `1` wave, `2` present, `3` point, `4` shrug, `5` nod, `6` think, `T` talk, `H` hide interface, `O` lock camera, `R` reset.

## URL options

| Parameter | Values | Use |
|---|---|---|
| `ui` | `0` | Clean capture with no interface |
| `frame` | `full`, `medium`, `close` | Full body, waist up, head and shoulders |
| `bg` | `dark`, `light`, `transparent` | Transparent removes floor and rings for compositing |
| `talk` | `1` | Start in talk mode |
| `gesture` | `wave`, `present`, `point`, `shrug`, `nod`, `think` | Play once on load |
| `orbit` | `0` | Lock camera |

Example: `http://127.0.0.1:5173/?ui=0&frame=medium&bg=transparent&talk=1`

## Automation API

Available as `window.mascotAPI` after the `mascot:ready` event.

```js
window.mascotAPI.playGesture('wave');   // optional duration in seconds
window.mascotAPI.talk(true);
window.mascotAPI.amplitude(0.7);
window.mascotAPI.frame('medium');
window.mascotAPI.background('transparent');
window.mascotAPI.orbit(false);
window.mascotAPI.ui(false);
window.mascotAPI.blink();
window.mascotAPI.captureFrame();        // PNG data URL of the current frame
window.mascotAPI.reset();
```

This is the intended hook for a future video pipeline. OBS can capture the browser window, or a headless browser can step through poses and capture frames for ffmpeg.

## Verification already done

- `npm run build` passes.
- Headless Chrome renders full, medium and close framings on 1280x800 and 900x900.
- Transparent background renders without floor or rings.
- `npm run check` verifies wave, point, finger curl, talk open/close and smile crossfade numerically.
- Visual passes found and fixed a shadowed face, mask-like glasses, disconnected-looking joints, an eye-covering hair cap, strip-like ribbon hair, blob-like clump hair, embedded chest details, a green rim-light streak on the hair, a buried neck, hood flaps beside the neck, and uniform robotic fingers.

Suggested lookdev check before any real video: view at the target aspect ratio, confirm the face is lit, confirm no limb clips through the torso at gesture extremes, confirm the accent reads against the background, then record a 5 second idle and a 5 second talking sample.

## Ponytail shortcuts

- Procedural primitives instead of a rigged external human model. Ceiling: limited facial range and no simulated cloth. Upgrade path: load a GLTF character with the same joint names and keep this animation layer.
- Hair is a displaced sphere cap, not a strand groom. Ceiling: no per-strand motion or realistic fiber shading. Upgrade path: replace `createHair` with a GLTF hair mesh or a ribbon-lock system validated at the target camera distance.
- Fingers are three-joint lathed sections with scripted curl and fan, not a skinned hand. Ceiling: no knuckle deformation or individual finger IK. Upgrade path: swap in a skinned GLTF hand and keep the same curl values as pose targets.
- Gestures are hand-authored rotations, not motion capture. Ceiling: limited natural variation. Upgrade path: retarget a GLTF/BVH clip onto the same joint tracks.
- Shadow is a single directional map. Ceiling: no soft area-light contact shadow. Upgrade path: a shadow catcher plane with a blurred contact texture for transparent output.

## Files

- `index.html` and `src/style.css`: page, interface, capture modes.
- `src/mascot.js`: character construction and animation. No DOM or renderer dependency, so it can be unit checked in Node.
- `src/main.js`: renderer, lights, camera framing, interface, URL options and public API.
- `scripts/check-rig.mjs`: numeric rig check.
