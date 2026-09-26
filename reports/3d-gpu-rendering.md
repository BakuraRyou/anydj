# Desktop 3D rendering

The desktop preview now selects WebGPU, then WebGL, then the existing Canvas renderer. Selection happens on first activation. No browser flags or additional packages are required by the app. Both GPU APIs request the high-performance adapter; the browser and driver decide which physical GPU is available.

## Implementation

- `dmx-stage-desktop.js` owns backend selection, initialization timeouts, fallback and disposal.
- `dmx-stage-gpu-scene.js` collects the shared room and fixture geometry into reusable vertex buffers and adjacent draw batches.
- `dmx-stage-webgpu.js` projects vertices and shades soft beams, lenses and footprints with WGSL. It uses 4-sample antialiasing.
- `dmx-stage-webgl.js` implements the same effects with GLSL for browsers without WebGPU.
- The original Canvas remains the pointer/keyboard/accessibility and label layer. The GPU canvas sits underneath it. There is no image copy or GPU readback in the production render loop.
- Device/context loss advances to the next backend. GPU buffers and canvases are released when the preview is destroyed. A late initialization result is also disposed after teardown.

Room geometry generation, diffuse surface colors, moving-head simulation and cone/room intersections still run in JavaScript. DMX output and music timing are unchanged. Rasterization, projection and soft beam effects move to the GPU. The previous CPU optimizations remain active in all paths.

Inspect the active path with:

```js
document.querySelector('.stage-3d-viewport > canvas').dataset.renderer
```

Values: `webgpu`, `webgl`, `canvas`. `dataset.rendererError` records the latest reason for falling back, if any.

## Verification

- Unit tests cover GPU/Canvas camera projection agreement, contiguous batches, reusable storage, blackout and near-plane crossing.
- `scripts/check-dmx-stage-gpu.mjs` executes real WGSL and GLSL with 20 animated fixtures, compares pixel output, tests WebGPU → WebGL and WebGL → Canvas loss recovery, and checks disposal.
- On this Linux test machine, use `VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/lvp_icd.json xvfb-run -a node scripts/check-dmx-stage-gpu.mjs`. The virtual display cannot reliably composite WebGPU; the test reads its actual swap texture directly instead. This readback is test-only.
- `ANYDJ_TEST_GPU=1 node scripts/check-camera-persistence.mjs` checks the integrated UI with WebGL, including ego mode, mouse movement, dolly and restored camera settings.
- `node scripts/check-dmx-stage-full.mjs` checks fullscreen controls and exit cleanup.

The browser test uses software Vulkan. Its timings do not measure physical GPU performance; FPS on the user's hardware remain to be measured.
