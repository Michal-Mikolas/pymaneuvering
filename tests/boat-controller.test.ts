import { BoatController } from '../lib/boat-controller.js';

describe('BoatController', () => {
  it('accurately wraps the physics engine and maps coordinates', () => {
    const controller = new BoatController();

    // Match conditions from mmg.test.js: "performs pstep correctly"
    // Initial state: X = [2.0, 0.1, 0.05], pos = [0, 0], psi = 0
    (controller as any).uvr = [2.0, 0.1, 0.05];
    (controller as any).pos = [0.0, 0.0];
    (controller as any).psi = 0.0;

    // Inputs to get nps=5, delta=10 deg (0.17453 radians)
    // MAX_PROPELLER_NPS = 21.333... (1280/60)
    // MAX_RUDDER_ANGLE = 35 deg
    const throttle = 5 / (1280 / 60); // 300 / 1280 = 15/64 = 0.234375
    const steering = 10 / 35;         // 2/7 = 0.285714...

    controller.setControls(throttle, steering);
    controller.update(1.0); // dt = 1.0

    // Expected values from mmg.test.js:
    // expectedEta = [2.019887760134399, 0.0802785955246814, 0.04732116322470926]
    // Mapping:
    // x = eta[1] (Easting)
    // z = -eta[0] (-Northing)
    // rotationY = -eta[2] (-Heading)

    expect(controller.position.x).toBeCloseTo(0.0802785955246814, 5);
    expect(controller.position.z).toBeCloseTo(-2.019887760134399, 5);
    expect(controller.rotationY).toBeCloseTo(-0.04732116322470926, 5);
    expect(controller.position.y).toBe(0);
    
    // Check RPM
    expect(controller.currentEngineRPM).toBeCloseTo(throttle * 3200, 5);
  });

  it('clamps control inputs between -1.0 and 1.0', () => {
    const controller = new BoatController();
    controller.setControls(2.0, -5.0);
    
    // Internal throttle and steering should be clamped
    expect((controller as any).throttle).toBe(1.0);
    expect((controller as any).steering).toBe(-1.0);
  });
});
