import './style.css';
import { tanker } from './vessels/tanker';
import { RenderingEngine } from './rendering-engine';
import { BoatController } from '../lib/boat-controller';

const container = document.getElementById('app');
const throttleInput = document.getElementById('throttle') as HTMLInputElement;
const steeringInput = document.getElementById('steering') as HTMLInputElement;
const speedVal = document.getElementById('speed-val');
const rpmVal = document.getElementById('rpm-val');
const followShipInput = document.getElementById('follow-ship') as HTMLInputElement;
const showPivotPointInput = document.getElementById('show-pivot-point') as HTMLInputElement;
const vesselOpacityInput = document.getElementById('vessel-opacity') as HTMLInputElement;

if (!container) {
  throw new Error("Could not find '#app' container in DOM.");
}

const engine = new RenderingEngine(container);
const boat = new BoatController(tanker);

// Ensure throttle starts at 0
if (throttleInput) {
  throttleInput.value = "0";
}

if (steeringInput) {
  steeringInput.value = "0";
}

if (followShipInput) {
  followShipInput.checked = true;
}

if (showPivotPointInput) {
  showPivotPointInput.checked = true;
}

if (vesselOpacityInput) {
  vesselOpacityInput.value = "0.8";
}

function applyControls(): void {
  const throttle = throttleInput ? parseFloat(throttleInput.value) : 0;
  const steering = steeringInput ? parseFloat(steeringInput.value) : 0;

  boat.setControls(throttle, steering);
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
  const followShip = followShipInput ? followShipInput.checked : true;
  const showPivotPoint = showPivotPointInput ? showPivotPointInput.checked : false;
  const rawOpacity = vesselOpacityInput ? parseFloat(vesselOpacityInput.value) : 0.8;
  const vesselOpacity = Number.isFinite(rawOpacity) ? Math.min(1, Math.max(0, rawOpacity)) : 0.8;

  engine.setFollowShip(followShip);
  engine.setShowPivotPoint(showPivotPoint);
  engine.setVesselOpacity(vesselOpacity);
}

// UI Listeners
if (throttleInput) {
  throttleInput.addEventListener('input', applyControls);
}

if (steeringInput) {
  steeringInput.addEventListener('input', applyControls);
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

setupCollapsibles();
applyControls();
applySimulationSettings();

// Initialize vessel
engine.loadVessel(tanker).then(() => {
  console.log('Tanker loaded successfully (or via fallback).');
  applySimulationSettings();
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
