# Browser Vessel Maneuvering Simulator

This repository is an in-progress browser-based simulator for boats and sea vessels maneuvering under power. The long-term goal is a realistic low-speed and docking simulator.

The project combines:

- A browser app built with Vite, TypeScript, and Three.js
- A JavaScript port of the `pymaneuvering` physics library under `lib/jsmaneuvering`
- The original Python `pymaneuvering` reference implementation under `lib/pymaneuvering`

For this project, `pymaneuvering` is the golden standard.

---

## 🛑 CRITICAL DIRECTIVES FOR AI AGENTS
**Read these rules before executing any code changes:**

1. **Protect Forward-Motion Physics:** Forward-motion behavior in `pymaneuvering` is considered correct and well-tested. Do not change `pymaneuvering` or `jsmaneuvering` forward-motion logic or tests unless the user explicitly asks for it and provides a very strong reason.
2. **Backward/Astern Physics:** Astern motion may still contain bugs (like negative damping) and is an acceptable area for investigation and fixes, provided forward-motion tests remain unchanged.
3. **NO `mathjs` or Memory Allocation:** To maintain 60 FPS without Garbage Collection stutters, this project strictly uses **`gl-matrix`** for all linear algebra. Do not install or use `mathjs`, `numericjs`, or write math that returns new arrays inside the `jsmaneuvering` physics loop. Always use `gl-matrix` `out` parameters (e.g., `vec3.add(out, a, b)`).
4. **Floating-Point Assertions:** Because V8 JS and Python handle floating-point math slightly differently, use approximation matchers (e.g., Jest's `expect().toBeCloseTo()`) for all physics test assertions.

---

## Project Goal

The current app is a simple top-down powered-vessel simulator:

- A vessel profile defines dimensions, assets, and control limits
- The browser UI exposes a throttle slider
- `BoatController` converts game controls into physics-engine inputs
- `RenderingEngine` visualizes the vessel and follows it with an orthographic camera

The intended direction is a realistic docking simulator, so future work will likely include:

- Better vessel visuals and loading of 3D assets
- Rudder/steering UI and richer helm/engine controls
- Multiple vessel profiles
- Harbor/dock geometry, collision handling, and aids to maneuvering
- Environmental effects and low-speed handling improvements

## Technology Stack

- Runtime/app: TypeScript, native ESM, Vite
- Rendering: Three.js
- Physics: local JS port of `pymaneuvering` in `lib/jsmaneuvering`
- Reference implementation: Python package in `lib/pymaneuvering`
- Testing: Jest + `ts-jest` for TS/JS tests
- Math dependency used by the physics port: `gl-matrix` (Strictly enforced)

## Repository Map

- `src/main.ts`
  - Browser entry point
  - Wires DOM controls to the simulator
  - Runs the animation loop
- `src/rendering-engine.ts`
  - Three.js scene setup
  - Orthographic camera
  - Water plane, buoy grid, vessel visual, camera follow
- `src/vessels/types.ts`
  - `VesselProfile` interface
- `src/vessels/tanker.ts`
  - Current vessel definition
  - Uses `VTYPE.KVLCC2_L64` from `jsmaneuvering`
- `lib/boat-controller.ts`
  - Main app-level adapter between UI/game code and the physics engine
  - Owns persistent vessel state (`uvr`, `pos`, `psi`)
  - Translates human limits (Max Engine RPM, Gear Ratios) into scientific limits (`nps`).
  - Maps normalized controls to `nps` and `delta`
  - Maps maritime coordinates into Three.js coordinates
- `lib/jsmaneuvering`
  - JavaScript port of the physics library
  - Contains its own README, source, and unit tests
- `lib/pymaneuvering`
  - Python reference implementation
  - Contains its own README, source, and pytest suite
- `tests/boat-controller.test.ts`
  - App-specific integration-ish test for the wrapper/controller layer
- `public/assets`
  - Vessel assets served by Vite

## Current Runtime Flow

1. `index.html` creates the canvas mount and HUD.
2. `src/main.ts` creates:
   - `RenderingEngine`
   - `BoatController` (Injected with a `VesselProfile` like `tanker`)
3. The throttle slider emits a normalized value in `[-1, 1]`.
4. `BoatController.setControls(throttle, steering)` stores normalized control inputs.
5. On each animation frame:
   - `dt` is computed and clamped to `0.1 s`
   - `BoatController.update(dt)` calculates actual `nps` using the profile's Engine RPM and Gear Ratio, then calls `vessel.pstep(...)`
   - HUD values are updated from controller state
   - `RenderingEngine.updateVesselTransform(...)` updates the vessel mesh
   - Three.js renders the scene

## Physics API Used by the App

The JS app currently uses the `Vessel` dispatcher from `lib/jsmaneuvering/src/vessel.js`.

Key exports:

- `VTYPE`
  - `KVLCC2_L64`
  - `GMS_LIKE`
- `IntegrationMode`
  - `TRAPEZOIDAL`
  - `RK4`
- `Vessel`
  - `new Vessel({ new_from: VTYPE.KVLCC2_L64 })`
  - Methods:
    - `dynamics(args)`
    - `step(args)`
    - `pstep(args)`
    - `nps_from_u(u)`

The simulator currently uses the MMG path with `KVLCC2_L64`.

### `pstep(...)` contract

For MMG vessels the app calls:

```ts
const [newUvr, newEta] = vessel.pstep({
  X: uvr,
  pos,
  dT: dt,
  nps,
  delta,
  psi,
  water_depth: 15.0,
});
```

Where:

- `X = [u, v, r]`
  - surge velocity [m/s]
  - sway velocity [m/s]
  - yaw rate [rad/s]
- `pos = [x, y]`
  - northing, easting [m]
- `psi`
  - heading [rad]
- `nps`
  - propeller revolutions per second (Calculated in BoatController)
- `delta`
  - rudder angle [rad]

Return value:

- `newUvr = [u, v, r]`
- `newEta = [x, y, psi]`

## Coordinate Systems

This matters a lot when changing rendering or controls.

`jsmaneuvering` uses maritime/world coordinates:

- `x`: North / forward
- `y`: East / starboard
- `psi`: heading

The app maps them into the Three.js scene in `BoatController`:

- Three.js `position.x = East = eta[1]`
- Three.js `position.z = -North = -eta[0]`
- Three.js `rotationY = -psi`

`RenderingEngine` then applies the heading onto the flat vessel mesh using `mesh.rotation.z`, because the mesh is laid down onto the XZ plane with a `-PI/2` X rotation.

If visuals look rotated or mirrored, check the mapping here first before touching the physics.

## Vessel Profile Contract

The current app-level abstraction for a ship is `VesselProfile` in `src/vessels/types.ts`.

It currently includes:

- Identity
  - `id`, `name`
- Physics
  - `physicsModel`
- Dimensions
  - `length`, `beam` (Used by RenderEngine to scale SVGs and Meshes)
- Engine
  - `maxEngineRPM`
  - `reductionGearRatio`
- Steering
  - `maxRudderAngleRads`
- Assets
  - `model3DPath`
  - `sprite2DPath`

To add a new vessel, the current pattern is:

1. Create a new file in `src/vessels/`
2. Point `physicsModel` at an existing `VTYPE`
3. Add assets under `public/assets/vessels/...`
4. Instantiate the new profile from `src/main.ts`

## Rendering Layer Notes

Current rendering is intentionally simple:

- Orthographic top-down camera
- Blue plane for water
- Red buoy grid for scale and orientation
- Vessel drawn from a sprite if available, otherwise a gray fallback plane
- Camera tracks the vessel in X/Z

This means most current realism comes from the physics, not the graphics.

The code already includes a `model3DPath`, but `RenderingEngine` currently loads only `sprite2DPath`. If you add 3D model loading, keep the physics/render separation intact:

- `BoatController` should remain the source of truth for physical state
- `RenderingEngine` should only visualize that state

## Tests And What They Mean

### Browser app tests

- `tests/boat-controller.test.ts`
  - Verifies that `BoatController` correctly wraps `jsmaneuvering`
  - Verifies coordinate mapping from physics space into render space
  - Verifies control clamping and Gear Ratio/RPM translations.

### JS physics tests

- `lib/jsmaneuvering/tests/mmg.test.js`
  - Checks MMG `dynamics`, `step`, `pstep`, `nps_from_u`
  - Checks current, wind, shallow-water, and zero-velocity scenarios
  - Includes reverse-motion safeguards
- `lib/jsmaneuvering/tests/abkowitz.test.js`
  - Checks Abkowitz `dynamics` and `pstep`
  - Verifies integration modes and some error paths
- `lib/jsmaneuvering/tests/calibration.test.js`
  - Checks MMG calibration from a minimal vessel description

### Python reference tests

- `lib/pymaneuvering/tests/test_mmg_dynamics.py`
- `lib/pymaneuvering/tests/test_abkowitz_dynamics.py`
- `lib/pymaneuvering/tests/test_calibration.py`
- `lib/pymaneuvering/tests/test_utils.py`

These Python tests are important because they define the expected reference behavior for the port.

## Development Rules For AI Agents

Use these rules unless the user explicitly asks for something else.

### 1. Treat `pymaneuvering` as authoritative

- If the browser simulator behaves strangely, first suspect:
  - input scaling
  - unit conversion
  - coordinate mapping
  - render transform bugs
  - app integration bugs
- Only change core `jsmaneuvering` physics when there is strong evidence of a real porting bug.
- If a change touches forward-motion behavior, compare it against the Python reference first.

### 2. Do not casually edit forward-motion physics or forward-motion tests

This is the highest-priority project constraint.

- Do not alter forward-motion MMG behavior in `lib/pymaneuvering`
- Do not alter forward-motion MMG behavior in `lib/jsmaneuvering`
- Do not weaken or rewrite forward-motion tests to make changes pass

Safe default:

- Assume forward propulsion and forward maneuvering are correct
- Assume backward/astern behavior may still need work

### 3. Prefer changing the simulator layer before the physics layer

Usually safer places to work:

- `src/main.ts`
- `src/rendering-engine.ts`
- `src/vessels/*.ts`
- `lib/boat-controller.ts`
- `index.html`
- `src/style.css`

Examples:

- Add new HUD data
- Add steering controls
- Add camera modes
- Add vessel switching
- Add scene props or dock geometry
- Add app-level helpers for autopilot, assistance, or replay

### 4. Keep physics and rendering decoupled

- `BoatController` should remain a thin adapter around the physics engine
- `RenderingEngine` should not own simulation state
- Vessel profiles should stay declarative

### 5. Add tests when behavior changes

If you modify:

- coordinate mapping: update/add `tests/boat-controller.test.ts`
- app integration with physics: add controller tests
- reverse-motion physics: add focused JS tests in `lib/jsmaneuvering/tests`

If you ever change a `jsmaneuvering` formula, you should have a comparison story against the Python reference.

## Known Safe/Unsafe Change Areas

### Generally safe

- UI controls and HUD
- camera behavior
- scene rendering
- asset loading
- new vessel profile files
- app-level state handling
- tests for new simulator features
- reverse/astern-motion fixes with evidence

### High-risk

- `lib/jsmaneuvering/src/mmg/*`
- `lib/pymaneuvering/src/pymaneuvering/mmg/*`
- any code path that changes forward-motion MMG results
- modifying existing golden-reference expectations without justification

## Commands

Install dependencies:

```bash
npm install
```

Run the browser app:

```bash
npm run dev
```

Run JS/TS tests:

```bash
npm test
```

Notes:

- The Jest config runs:
  - top-level app tests in `tests/`
  - embedded JS physics tests in `lib/jsmaneuvering/tests/`
- Python tests in `lib/pymaneuvering/tests/` are not run by `npm test`

## Practical Guidance For Future Feature Work

When adding a feature, use this checklist:

1. Identify whether the feature is:
   - rendering/UI
   - controller/integration
   - vessel-definition
   - physics-core
2. If it is not obviously physics-core, keep the change out of `jsmaneuvering`.
3. If it touches vessel motion, verify whether the issue is:
   - bad input scaling
   - wrong units
   - wrong sign
   - wrong coordinate transform
   - bad asset orientation
4. If the issue only appears in astern motion, a `jsmaneuvering` fix may be appropriate.
5. Protect behavior with tests before and after the change when possible.

## Summary

Think of this repository as three layers:

1. `lib/pymaneuvering`: the Python reference and golden standard
2. `lib/jsmaneuvering`: the browser-usable JS port that should stay aligned with the reference, especially in forward motion
3. `src/` + `lib/boat-controller.ts`: the actual simulator app layer where most ongoing product work should happen

If you are unsure where to make a change, prefer the app layer first and treat forward-motion physics as protected.