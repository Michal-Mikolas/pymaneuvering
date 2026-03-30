import './style.css';
import { RenderingEngine } from './rendering-engine';
import { BoatController } from '../lib/boat-controller';
import { KeyboardAxisController } from './keyboard-axis-controller';
import { availableVessels, getVesselById } from './vessels/index.js';
import { VesselProfile } from './vessels/types.js';

const container = document.getElementById('app');
const throttleInput = document.getElementById('throttle') as HTMLInputElement;
const steeringInput = document.getElementById('steering') as HTMLInputElement;
const speedVal = document.getElementById('speed-val');
const rpmVal = document.getElementById('rpm-val');
const hudPanels = document.querySelectorAll<HTMLElement>('.hud-panel');
const followShipInput = document.getElementById('follow-ship') as HTMLInputElement;
const showPivotPointInput = document.getElementById('show-pivot-point') as HTMLInputElement;
const vesselOpacityInput = document.getElementById('vessel-opacity') as HTMLInputElement;
const uiOpacityInput = document.getElementById('ui-opacity') as HTMLInputElement;
const vesselSelect = document.getElementById('vessel-select') as HTMLSelectElement;
const defaultVessel = availableVessels.find((vessel) => vessel.id === 'j105_deep_keel') ?? availableVessels[0];

if (!container) {
  throw new Error("Could not find '#app' container in DOM.");
}

const engine = new RenderingEngine(container);
let activeVessel = defaultVessel;
let boat = new BoatController(activeVessel);

function populateVesselSelect(): void {
  if (!vesselSelect) {
    return;
  }

  vesselSelect.replaceChildren(
    ...availableVessels.map((vessel) => {
      const option = document.createElement('option');
      option.value = vessel.id;
      option.textContent = vessel.name;
      return option;
    })
  );
  vesselSelect.value = activeVessel.id;
}

// Ensure throttle starts at 0
if (throttleInput) {
  throttleInput.value = "0";
}

if (steeringInput) {
  steeringInput.value = "0";
}

if (followShipInput) {
  followShipInput.checked = false;
}

if (showPivotPointInput) {
  showPivotPointInput.checked = true;
}

if (vesselOpacityInput) {
  vesselOpacityInput.value = "0.8";
}

if (uiOpacityInput) {
  uiOpacityInput.value = "0.8";
}

const steeringKeyboard = new KeyboardAxisController({
  holdBindings: {
    KeyA: -1,
    KeyD: 1,
  },
  centerBindings: ['KeyW', 'KeyS'],
  holdUnitsPerSecond: 1,
  snapUnitsPerSecond: 2,
  centerUnitsPerSecond: 2,
});

const throttleKeyboard = new KeyboardAxisController({
  holdBindings: {
    Numpad2: -1,
    Numpad8: 1,
  },
  doubleTapBindings: {
    Numpad2: -1,
    Numpad8: 1,
  },
  centerBindings: ['Numpad5'],
  holdUnitsPerSecond: 1,
  snapUnitsPerSecond: 2,
  centerUnitsPerSecond: 2,
});

function syncKeyboardStateFromInputs(): void {
  if (throttleInput) {
    throttleKeyboard.setValue(parseFloat(throttleInput.value));
  }

  if (steeringInput) {
    steeringKeyboard.setValue(parseFloat(steeringInput.value));
  }
}

function applyControls(): void {
  const throttle = throttleInput ? parseFloat(throttleInput.value) : 0;
  const steering = steeringInput ? parseFloat(steeringInput.value) : 0;

  boat.setControls(throttle, steering);
}

async function loadActiveVessel(profile: VesselProfile): Promise<void> {
  activeVessel = profile;
  boat = new BoatController(profile);
  applyControls();
  await engine.loadVessel(profile);
  applySimulationSettings();
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target.isContentEditable) {
    return true;
  }

  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) {
    return true;
  }

  if (target instanceof HTMLInputElement) {
    return !['range', 'checkbox', 'radio', 'button'].includes(target.type);
  }

  return false;
}

function handleKeyboardControlChange(changed: boolean, input: HTMLInputElement | null, controller: KeyboardAxisController): void {
  if (!changed || !input) {
    return;
  }

  input.value = controller.getValue().toFixed(2);
}

function toggleCollapsibleState(containerEl: HTMLElement, isOpen: boolean, trigger: HTMLButtonElement): void {
  containerEl.classList.toggle('is-open', isOpen);
  trigger.setAttribute('aria-expanded', String(isOpen));
}

function setupCollapsibles(): void {
  const toggleButtons = document.querySelectorAll<HTMLButtonElement>('.panel-toggle, .section-toggle');

  toggleButtons.forEach((button) => {
    const collapsible = button.closest<HTMLElement>('.collapsible-panel, .collapsible-section');
    if (!collapsible) {
      return;
    }

    button.addEventListener('click', () => {
      const isOpen = !collapsible.classList.contains('is-open');
      toggleCollapsibleState(collapsible, isOpen, button);
    });
  });
}

function applySimulationSettings(): void {
  const followShip = followShipInput ? followShipInput.checked : false;
  const showPivotPoint = showPivotPointInput ? showPivotPointInput.checked : false;
  const rawVesselOpacity = vesselOpacityInput ? parseFloat(vesselOpacityInput.value) : 0.8;
  const rawUiOpacity = uiOpacityInput ? parseFloat(uiOpacityInput.value) : 0.8;
  const vesselOpacity = Number.isFinite(rawVesselOpacity) ? Math.min(1, Math.max(0, rawVesselOpacity)) : 0.8;
  const uiOpacity = Number.isFinite(rawUiOpacity) ? Math.min(1, Math.max(0, rawUiOpacity)) : 0.8;

  engine.setFollowShip(followShip);
  engine.setShowPivotPoint(showPivotPoint);
  engine.setVesselOpacity(vesselOpacity);

  hudPanels.forEach((panel) => {
    panel.style.opacity = String(uiOpacity);
  });
}

// UI Listeners
if (throttleInput) {
  throttleInput.addEventListener('input', () => {
    syncKeyboardStateFromInputs();
    applyControls();
  });
}

if (steeringInput) {
  steeringInput.addEventListener('input', () => {
    syncKeyboardStateFromInputs();
    applyControls();
  });
}

if (followShipInput) {
  followShipInput.addEventListener('change', applySimulationSettings);
}

if (showPivotPointInput) {
  showPivotPointInput.addEventListener('change', applySimulationSettings);
}

if (vesselOpacityInput) {
  vesselOpacityInput.addEventListener('input', applySimulationSettings);
  vesselOpacityInput.addEventListener('change', applySimulationSettings);
}

if (uiOpacityInput) {
  uiOpacityInput.addEventListener('input', applySimulationSettings);
  uiOpacityInput.addEventListener('change', applySimulationSettings);
}

if (vesselSelect) {
  vesselSelect.addEventListener('change', () => {
    const nextVessel = getVesselById(vesselSelect.value);
    if (!nextVessel) {
      return;
    }

    void loadActiveVessel(nextVessel);
  });
}

document.addEventListener('keydown', (event) => {
  if (isTypingTarget(event.target)) {
    return;
  }

  const steeringHandled = steeringKeyboard.handleKeyDown(event.code, event.timeStamp, event.repeat);
  const throttleHandled = throttleKeyboard.handleKeyDown(event.code, event.timeStamp, event.repeat);

  handleKeyboardControlChange(steeringHandled, steeringInput, steeringKeyboard);
  handleKeyboardControlChange(throttleHandled, throttleInput, throttleKeyboard);

  if (steeringHandled || throttleHandled) {
    applyControls();
    event.preventDefault();
  }
});

document.addEventListener('keyup', (event) => {
  const steeringHandled = steeringKeyboard.handleKeyUp(event.code);
  const throttleHandled = throttleKeyboard.handleKeyUp(event.code);

  if (steeringHandled || throttleHandled) {
    event.preventDefault();
  }
});

window.addEventListener('blur', () => {
  steeringKeyboard.clearHeldKeys();
  throttleKeyboard.clearHeldKeys();
});

setupCollapsibles();
populateVesselSelect();
syncKeyboardStateFromInputs();
applyControls();
applySimulationSettings();

// Initialize vessel
loadActiveVessel(activeVessel).then(() => {
  console.log(`${activeVessel.name} loaded successfully (or via fallback).`);
});

// Animation loop
let lastTime = performance.now();

function animate() {
  requestAnimationFrame(animate);
  
  const currentTime = performance.now();
  let dt = (currentTime - lastTime) / 1000; // Delta time in seconds
  lastTime = currentTime;

  // Cap delta time to prevent physics explosion (e.g., when switching tabs)
  dt = Math.min(dt, 0.1);

  const steeringChanged = steeringKeyboard.update(dt);
  const throttleChanged = throttleKeyboard.update(dt);

  handleKeyboardControlChange(steeringChanged, steeringInput, steeringKeyboard);
  handleKeyboardControlChange(throttleChanged, throttleInput, throttleKeyboard);

  if (steeringChanged || throttleChanged) {
    applyControls();
  }

  // Update Physics
  boat.update(dt);

  // Update HUD
  if (rpmVal) rpmVal.textContent = Math.round(boat.currentEngineRPM).toString();
  if (speedVal) {
    const knots = boat.currentSpeed * 1.94384; // 1 m/s ? 1.94 knots
    speedVal.textContent = knots.toFixed(2);
  }

  // Update Visuals
  engine.updateVesselTransform(boat.position, boat.rotationY, boat.pivotPoint);
  
  // Render
  engine.render();
}

animate();
