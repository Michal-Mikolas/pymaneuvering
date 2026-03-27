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
