# pymaneuvering (JavaScript Port)

Welcome to the JavaScript port of `pymaneuvering`, a 3DOF marine maneuvering physics library. 
This port provides high-performance, real-time ship dynamics mathematically identical to the Python original. It is designed specifically for integration into game engines (e.g., Three.js, Babylon.js, or 2D Canvas) running at 60 FPS.

## 1. Introduction & Architecture

The library calculates **3DOF (Degrees of Freedom)** maneuvering:
- **Surge** (Forward/Backward translation)
- **Sway** (Port/Starboard translation)
- **Yaw** (Heading rotation)

**Performance & Memory:**
To guarantee zero-allocation performance in hot game loops, the library has a strict dependency on [`gl-matrix`](https://glmatrix.net/). Internally, linear algebra operations reuse array buffers to prevent garbage collection stutter.

**Coordinate System (CRITICAL for 3D Engines):**
The physics engine operates in a standard maritime coordinate system:
- **X:** North / Forward (Surge)
- **Y:** East / Starboard (Sway)
- **Z / Psi ($\psi$):** Heading / Yaw (Positive is clockwise from above)

*WebGL Conversion Note:* Most web 3D engines (like Three.js) use a Y-up, right-handed coordinate system. To map the ship's output `[x, y]` to your 3D scene, you will typically need to map:
- `pymaneuvering` North (X) $\rightarrow$ `Three.js` -Z 
- `pymaneuvering` East (Y) $\rightarrow$ `Three.js` +X
- `pymaneuvering` Heading ($\psi$) $\rightarrow$ `Three.js` -Y rotation

## 2. Data Structures & State

The vessel's state is directly represented by standard flat arrays (compatible with `gl-matrix` `vec3` / `Float32Array` or standard JavaScript `Array`). 

Core methods like `pstep` will return state in the form of two distinct arrays:
- **`uvr`** `[u, v, r]`: Local velocities; Surge (`m/s`), Sway (`m/s`), Yaw Rate (`rad/s`).
- **`eta`** `[x, y, psi]`: Global positions; North (`m`), East (`m`), Heading (`rad`).

The outputs are clean structural arrays ready to be destructured or directly fed into your rendering pipeline.

## 3. The MMG Model (Standard Ship Maneuvering)

The MMG model separates forces acting on the Hull, Propeller, and Rudder. It is excellent for representing ocean-going vessels, handling dynamic speed changes, and accurately modeling realistic low-speed/docking behavior.

### Initialization

```javascript
import { Vessel } from './src/vessel.js'; 
import { VTYPE } from './src/index.js';

// Initialize a KVLCC2 Tanker (MMG Model)
const tanker = new Vessel({ new_from: VTYPE.KVLCC2_L64 });

// Initial State
let X = [2.0, 0.0, 0.0];      // u, v, r [m/s, m/s, rad/s]
let pos = [0.0, 0.0];         // x, y [m]
let psi = 0.0;                // Heading [rad]
```

### Input Methods
For the MMG model, you primarily control the **Rudder Angle** (`delta`) and **Propeller Revolutions** (`nps`).
- `delta`: Rudder angle in radians.
- `nps`: Engine propeller revolutions per second (`1/s`). 

*Tip:* You can calculate the required `nps` to maintain a desired surge velocity using `tanker.nps_from_u(desired_speed_ms)`.

### Real-Time Game Loop Example

```javascript
let lastTime = performance.now();

// Game loop inputs
let currentRudder = 10 * (Math.PI / 180); // ~10 degrees
let currentNps = tanker.nps_from_u(2.0);  // Calculate RPM required for 2.0 m/s

function animate() {
  requestAnimationFrame(animate);

  const now = performance.now();
  const dt = (now - lastTime) / 1000; // Delta time in seconds
  lastTime = now;

  // Step the physics engine forward
  const [newUvr, newEta] = tanker.pstep({
    X: X,
    pos: pos,
    dT: dt,               // Time step [s]
    nps: currentNps,      // REQUIRED for MMG
    delta: currentRudder, // Rudder angle [rad]
    psi: psi,
    water_depth: 15.0     // Optional: shallow water depth [m]
    // fl_vel: 0.5,       // Optional: Current speed [m/s]
    // fl_psi: Math.PI/4  // Optional: Current direction [rad]
  });

  // Update persistent state for the next frame
  X = newUvr;
  pos = [newEta[0], newEta[1]];
  psi = newEta[2];

  // Map to your 3D Mesh (e.g., Three.js)
  // shipMesh.position.set(pos[1], 0, -pos[0]); // East -> X, North -> -Z
  // shipMesh.rotation.y = -psi;                // Match heading
}

animate();
```

## 4. The Abkowitz Model (Whole-Ship Polynomial)

The Abkowitz model uses a Taylor-series expansion to treat the entire ship as a single rigid body experiencing hydrodynamic forces. It is historically standard for steering and course-keeping, particularly well-suited for inland barges and operations explicitly built around shallow water.

### Initialization

```javascript
import { Vessel } from './src/vessel.js';
import { VTYPE, IntegrationMode } from './src/index.js';

// Initialize a GMS-like Inland Barge (Abkowitz Model)
const barge = new Vessel({ new_from: VTYPE.GMS_LIKE });

let X = [2.5, 0.0, 0.0]; // Surge velocity implicitly drives this model
let pos = [0.0, 0.0];
let psi = 0.0;
```

### Model Specifics / Limitations
- `nps` (propeller RPM) is **NOT supported**. Surge velocity (`u`) implicitly represents the longitudinal drive. You cannot simulate detailed engine transients (accelerating from 0) using this configuration.
- `water_depth` is **REQUIRED**. Shallow water effects are strictly integral to the inland barge coefficients.

### Real-Time Game Loop Example

```javascript
let lastTime = performance.now();
let currentRudder = 15 * (Math.PI / 180); 

function animate() {
  requestAnimationFrame(animate);

  const now = performance.now();
  const dt = (now - lastTime) / 1000;
  lastTime = now;

  const [newUvr, newEta] = barge.pstep({
    X: X,
    pos: pos,
    dT: dt,
    delta: currentRudder,
    psi: psi,
    water_depth: 3.5, // REQUIRED (depth in meters)
    mode: IntegrationMode.RK4 // Explicit numerical integration method
  });

  X = newUvr;
  pos = [newEta[0], newEta[1]];
  psi = newEta[2];

  // Update game engine visual layer
}

animate();
```

## 5. Utility Functions

The library exports several useful constants and shared utilities for convenience:

- **`VTYPE`**: Exposes the predefined templates (`VTYPE.KVLCC2_L64`, `VTYPE.GMS_LIKE`).
- **`IntegrationMode`**: Specifies the numerical integration method (`IntegrationMode.TRAPEZOIDAL` or `IntegrationMode.RK4`). For real-time applications with potentially fluctuating step sizes, `RK4` typically provides better stability.
- Common physics utilities (like radians-to-degrees) can be done with standard `Math` operations, e.g., `const rad = deg * (Math.PI / 180)`.
