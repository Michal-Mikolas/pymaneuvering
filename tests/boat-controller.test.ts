import { BoatController } from '../lib/boat-controller.js';
import { j105 } from '../src/vessels/j105.js';
import { tanker } from '../src/vessels/tanker.js';

describe('BoatController', () => {
  it('accurately wraps the physics engine and maps coordinates using the Tanker profile', () => {
    const controller = new BoatController(tanker);

    // Initial state: X = [2.0, 0.1, 0.05], pos = [0, 0], psi = 0
    (controller as any).uvr = [2.0, 0.1, 0.05];
    (controller as any).pos = [0.0, 0.0];
    (controller as any).psi = 0.0;

    // Inputs to get max nps for tanker:
    // maxEngineRPM = 450, reductionGearRatio = 1.0 -> maxPropellerNPS = 7.5
    // We set throttle to 1.0 to get nps = 7.5
    // maxRudderAngleRads = 35 deg -> steering 10/35 to get 10 deg
    const throttle = 1.0; 
    const steering = 10 / 35;

    controller.setControls(throttle, steering);
    controller.update(1.0); // dt = 1.0

    // Expected values calculated via current controller wiring for nps=7.5, delta=10deg:
    // expectedEta = [2.0383312702178955, 0.08034950494766235, 0.047312743961811066]
    // Mapping:
    // x = eta[1] (Easting)
    // z = -eta[0] (-Northing)
    // rotationY = -eta[2] (-Heading)

    expect(controller.position.x).toBeCloseTo(0.08034950494766235, 5);
    expect(controller.position.z).toBeCloseTo(-2.0383312702178955, 5);
    expect(controller.rotationY).toBeCloseTo(-0.047312743961811066, 5);
    expect(controller.position.y).toBe(0);
    
    // Check RPM: throttle (1.0) * maxEngineRPM (450) = 450
    expect(controller.currentEngineRPM).toBe(450);
  });

  it('clamps control inputs between -1.0 and 1.0', () => {
    const controller = new BoatController(tanker);
    controller.setControls(2.0, -5.0);
    
    // Internal throttle and steering should be clamped
    expect((controller as any).throttle).toBe(1.0);
    expect((controller as any).steering).toBe(-1.0);
  });

  it('uses steering input to change heading over time', () => {
    const controller = new BoatController(tanker);

    (controller as any).uvr = [2.0, 0.0, 0.0];
    (controller as any).pos = [0.0, 0.0];
    (controller as any).psi = 0.0;

    controller.setControls(1.0, 0.5);
    controller.update(1.0);

    expect(controller.rotationY).not.toBeCloseTo(0, 5);
    expect(controller.position.x).not.toBeCloseTo(0, 5);
  });

  it('maps the physics engine pivot point into render coordinates', () => {
    const controller = new BoatController(tanker);

    (controller as any).uvr = [2.0, 0.1, 0.05];
    (controller as any).pos = [0.0, 0.0];
    (controller as any).psi = 0.0;

    controller.setControls(1.0, 10 / 35);
    controller.update(1.0);

    const [u, v, r] = (controller as any).uvr;
    const [north, east] = (controller as any).pos;
    const psi = (controller as any).psi;
    const longitudinalOffset = -v / r;
    const expectedNorth = north + Math.cos(psi) * longitudinalOffset;
    const expectedEast = east + Math.sin(psi) * longitudinalOffset;

    expect(u).toBeGreaterThan(0);
    expect(controller.pivotPoint).not.toBeNull();
    expect(controller.pivotPoint?.x).toBeCloseTo(expectedEast, 5);
    expect(controller.pivotPoint?.z).toBeCloseTo(-expectedNorth, 5);
    expect(controller.pivotPoint?.y).toBe(0);
  });

  it('hides the pivot point when the yaw rate is effectively zero', () => {
    const controller = new BoatController(tanker);

    (controller as any).uvr = [2.0, 0.0, 0.0];
    (controller as any).pos = [0.0, 0.0];
    (controller as any).psi = 0.0;

    controller.setControls(1.0, 0.0);
    controller.update(1.0);

    expect(controller.pivotPoint).toBeNull();
  });

  it('applies tanker prop-walk overrides during astern motion', () => {
    const controller = new BoatController(tanker);

    controller.setControls(-1.0, 0.0);
    controller.update(1.0);

    expect(controller.position.x).toBeLessThan(0);
    expect(controller.rotationY).toBeLessThan(0);
  });

  it('supports fully custom MMG vessel data for the J/105 profile', () => {
    const controller = new BoatController(j105);

    controller.setControls(0.8, 0.35);
    controller.update(0.5);

    expect(Number.isFinite(controller.position.x)).toBe(true);
    expect(Number.isFinite(controller.position.z)).toBe(true);
    expect(Number.isFinite(controller.rotationY)).toBe(true);
    expect(Number.isFinite(controller.currentSpeed)).toBe(true);
    expect(controller.currentEngineRPM).toBeCloseTo(2880, 5);
  });

  it('uses the astern gearbox ratio for reverse thrust on J/105', () => {
    const controller = new BoatController(j105);

    (controller as any).uvr = [0.0, 0.0, 0.0];
    (controller as any).pos = [0.0, 0.0];
    (controller as any).psi = 0.0;

    controller.setControls(-1.0, 0.0);
    controller.update(0.1);

    const appliedNps = (controller as any).vessel.model.dynamics({
      X: [0.0, 0.0, 0.0],
      psi: 0.0,
      delta: 0.0,
      nps: -((j105.engine.maxEngineRPM / (j105.engine.reductionGearRatioAstern ?? j105.engine.reductionGearRatio)) / 60.0),
    });

    expect(controller.currentEngineRPM).toBe(-3600);
    expect(Math.abs((j105.engine.maxEngineRPM / (j105.engine.reductionGearRatioAstern ?? j105.engine.reductionGearRatio)) / 60.0))
      .toBeLessThan(Math.abs((j105.engine.maxEngineRPM / j105.engine.reductionGearRatio) / 60.0));
    expect(appliedNps[0]).toBeLessThan(0);
  });

  it('gives the J/105 weaker astern acceleration than ahead from rest', () => {
    const ahead = new BoatController(j105);
    const astern = new BoatController(j105);

    ahead.setControls(1.0, 0.0);
    astern.setControls(-1.0, 0.0);

    for (let i = 0; i < 20; i += 1) {
      ahead.update(0.1);
      astern.update(0.1);
    }

    expect(ahead.currentSpeed).toBeGreaterThan(0);
    expect(astern.currentSpeed).toBeLessThan(0);
    expect(ahead.currentSpeed).toBeGreaterThan(Math.abs(astern.currentSpeed));
  });
});
