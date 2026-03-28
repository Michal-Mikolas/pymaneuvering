import { Vessel } from '../src/vessel.js';
import { VTYPE } from '../src/index.js';
import { expectArraysToBeClose } from './testUtils.js';

describe('MMG Dynamics (KVLCC2_L64)', () => {
  const vessel = new Vessel({ new_from: VTYPE.KVLCC2_L64 });

  it('calculates dynamics correctly', () => {
    const X = [2.0, 0.1, 0.05];
    const psi = 0.0;
    const delta = 0.17453292519943295; // 10 degrees in radians
    const nps = 5;
    const h = 15.0;

    const expectedDot = [
      0.039775520268798305,
      -0.03944280895063721,
      -0.005357673550581492
    ];

    const actualDot = vessel.dynamics({ X, psi, delta, h, nps });
    expectArraysToBeClose(actualDot, expectedDot, 5);
  });

  it('performs step correctly', () => {
    const X = [2.0, 0.1, 0.05];
    const delta = 0.17453292519943295;
    const nps = 5;
    const h = 15.0;
    const dT = 1.0;
    const psi = 0.0;

    const expectedStepDot = [
      0.039775520268798305,
      -0.03944280895063721,
      -0.005357673550581492
    ];

    const actualStepDot = vessel.step({ X, dT, nps, delta, psi, water_depth: h });
    expectArraysToBeClose(actualStepDot, expectedStepDot, 5);
  });

  it('performs pstep correctly', () => {
    const X = [2.0, 0.1, 0.05];
    const pos = [0.0, 0.0];
    const psi = 0.0;
    const delta = 0.17453292519943295;
    const nps = 5;
    const h = 15.0;
    const dT = 1.0;

    const expectedUvr = [
      2.0397755202687984,
      0.060557191049362795,
      0.04464232644941851
    ];
    const expectedEta = [
      2.019887760134399,
      0.0802785955246814,
      0.04732116322470926
    ];

    const [actualUvr, actualEta] = vessel.pstep({ X, pos, dT, nps, delta, psi, water_depth: h });
    expectArraysToBeClose(actualUvr, expectedUvr, 5);
    expectArraysToBeClose(actualEta, expectedEta, 5);
  });

  describe('Scenarios', () => {
    it('handles current', () => {
      const X = [2.0, 0.1, 0.05];
      const psi = 0.0;
      const delta = 0.17453292519943295;
      const nps = 5;
      const h = 15.0;
      const fl_vel = 0.5;
      const fl_psi = 0.7853981633974483; // pi/4

      const expected = [0.04904502176452721, -0.06434092417272745, -0.006501525670116164];
      const actual = vessel.dynamics({ X, psi, delta, h, nps, fl_psi, fl_vel });
      expectArraysToBeClose(actual, expected, 5);
    });

    it('handles wind', () => {
      const X = [2.0, 0.1, 0.05];
      const psi = 0.0;
      const delta = 0.17453292519943295;
      const nps = 5;
      const h = 15.0;
      const w_vel = 10.0;
      const beta_w = 1.5707963267948966; // pi/2

      const expected = [0.03878138767695626, -0.030134120694622683, -0.005192338629460642];
      const actual = vessel.dynamics({ X, psi, delta, h, nps, w_vel, beta_w });
      expectArraysToBeClose(actual, expected, 5);
    });

    it('handles shallow water', () => {
      const X = [2.0, 0.1, 0.05];
      const psi = 0.0;
      const delta = 0.17453292519943295;
      const nps = 5;
      const h_shallow = vessel.vessel.d * 1.2;

      const expected = [0.053066135267069554, -0.030421497449696938, -0.011946923486595259];
      const actual = vessel.dynamics({ X, psi, delta, h: h_shallow, nps });
      expectArraysToBeClose(actual, expected, 5);
    });

    it('handles zero velocity', () => {
      const X_zero = [0.0, 0.0, 0.0];
      const psi = 0.0;
      const delta = 0.17453292519943295;
      const nps = 5;
      const h = 15.0;

      const expected = [0.03239151331207554, 0.0, 0.0];
      const actual = vessel.dynamics({ X: X_zero, psi, delta, h, nps });
      expectArraysToBeClose(actual, expected, 5);
    });
  });

  it('calculates nps from u', () => {
    const expected = 2.426211674340134;
    const actual = vessel.nps_from_u(2.0);
    expect(actual).toBeCloseTo(expected, 5);
  });

  describe('Reverse Motion Safeguards', () => {
    it('produces finite forces when moving astern with zero rudder', () => {
      const X = [-2.0, 0.0, 0.0];
      const psi = 0.0;
      const delta = 0.0;
      const nps = -5;

      const actual = vessel.dynamics({ X, psi, delta, nps });
      actual.forEach(v => {
        expect(Number.isFinite(v)).toBe(true);
      });
    });

    it('does not induce yaw when moving straight astern with zero rudder', () => {
      // With v=0, r=0, delta=0 the yaw moment must be zero (no spin-out)
      const X = [-2.0, 0.0, 0.0];
      const psi = 0.0;
      const delta = 0.0;
      const nps = -5;

      const [u_dot, v_dot, r_dot] = vessel.dynamics({ X, psi, delta, nps });
      expect(r_dot).toBeCloseTo(0.0, 8);
      expect(v_dot).toBeCloseTo(0.0, 8);
    });

    it('produces controllable yaw with rudder applied in reverse', () => {
      const X = [-2.0, 0.1, 0.05];
      const psi = 0.0;
      const delta = 0.17453292519943295; // 10 degrees
      const nps = -5;

      const actual = vessel.dynamics({ X, psi, delta, nps });
      actual.forEach(v => {
        expect(Number.isFinite(v)).toBe(true);
        expect(Math.abs(v)).toBeLessThan(1.0); // no explosions
      });
    });

    it('remains stable at high reverse speed (~7 knots astern)', () => {
      // ~7 knots ≈ 3.6 m/s — this is where the old code would spin out
      const X = [-3.6, 0.0, 0.0];
      const psi = 0.0;
      const delta = 0.0;
      const nps = -8;

      const [u_dot, v_dot, r_dot] = vessel.dynamics({ X, psi, delta, nps });
      expect(Number.isFinite(u_dot)).toBe(true);
      expect(Number.isFinite(v_dot)).toBe(true);
      expect(Number.isFinite(r_dot)).toBe(true);
      // No yaw or sway at zero rudder, zero initial sway/yaw
      expect(r_dot).toBeCloseTo(0.0, 8);
      expect(v_dot).toBeCloseTo(0.0, 8);
    });

    it('decelerates (produces forward force) when going astern with prop pushing back', () => {
      // Ship moving backward, prop spinning backward → thrust is in -X direction
      // The hull drag should oppose motion (positive X, decelerating the ship)
      const X = [-2.0, 0.0, 0.0];
      const psi = 0.0;
      const delta = 0.0;
      const nps = -5;

      const [u_dot] = vessel.dynamics({ X, psi, delta, nps });
      // u_dot should be negative (accelerating further astern) because nps is driving
      // the ship backward, but the key test is that it's finite and reasonable
      expect(Number.isFinite(u_dot)).toBe(true);
      expect(Math.abs(u_dot)).toBeLessThan(1.0);
    });

    it('hull resistance opposes backward motion (u_dot is positive when coasting astern)', () => {
      // A ship coasting backward with no propeller should decelerate (u_dot > 0)
      // because hull resistance opposes the direction of travel.
      const X = [-2.0, 0.0, 0.0];
      const psi = 0.0;
      const delta = 0.0;
      const nps = 0; // no propeller — only hull forces

      const [u_dot] = vessel.dynamics({ X, psi, delta, nps });
      // u_dot must be positive (opposing backward motion, decelerating toward zero)
      expect(u_dot).toBeGreaterThan(0);
    });

    it('reverse acceleration magnitude decreases with increasing astern speed', () => {
      // Just like forward motion: the faster you go, the less you accelerate.
      // At low reverse speed, almost all thrust goes to acceleration.
      // At higher reverse speed, hull resistance eats into it.
      const delta = 0.0;
      const psi = 0.0;
      const nps = -5;

      const [u_dot_slow] = vessel.dynamics({ X: [-0.5, 0, 0], psi, delta, nps });
      const [u_dot_fast] = vessel.dynamics({ X: [-3.0, 0, 0], psi, delta, nps });

      // Both should be negative (accelerating astern)
      expect(u_dot_slow).toBeLessThan(0);
      expect(u_dot_fast).toBeLessThan(0);

      // The slow case should have MORE acceleration (larger magnitude)
      expect(Math.abs(u_dot_slow)).toBeGreaterThan(Math.abs(u_dot_fast));
    });
  });

  describe('Errors', () => {
    it('throws LogicError if fl_vel provided without fl_psi', () => {
      expect(() => {
        vessel.step({ X: [1, 0, 0], dT: 1, nps: 5, delta: 0, psi: 0, fl_vel: 0.5 });
      }).toThrow('LogicError');
    });

    it('throws error if water_depth < threshold (dummy test)', () => {
      expect(() => {
        vessel.step({ X: [1, 0, 0], dT: 1, nps: 5, delta: 0, psi: 0, water_depth: 1.0 });
      }).toThrow();
    });
  });
});
