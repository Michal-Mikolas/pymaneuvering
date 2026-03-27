import { Vessel } from '../src/vessel.js';
import { VTYPE, IntegrationMode } from '../src/index.js';
import { expectArraysToBeClose } from './testUtils.js';

describe('Abkowitz Dynamics (GMS_LIKE)', () => {
  const vessel = new Vessel({ new_from: VTYPE.GMS_LIKE });

  it('calculates dynamics correctly', () => {
    const X = [2.0, 0.1, 0.05];
    const psi = 0.0;
    const delta = 0.17453292519943295; // 10 degrees in radians
    const h = 15.0;

    const expectedDot = [
      0.015231531436260673,
      -0.02412783530822922,
      -0.008898846872757054
    ];

    const actualDot = vessel.dynamics({ X, psi, delta, h });
    expectArraysToBeClose(actualDot, expectedDot, 5);
  });

  it('performs pstep in TRAPEZOIDAL mode correctly', () => {
    const X = [2.0, 0.1, 0.05];
    const pos = [0.0, 0.0];
    const psi = 0.0;
    const delta = 0.17453292519943295;
    const h = 15.0;
    const dT = 1.0;

    const expectedUvr = [
      2.0152316093444824,
      0.07587216794490814,
      0.04110115393996239
    ];
    const expectedEta = [
      2.004843235015869,
      -0.13377834856510162,
      0.04555057734251022
    ];

    const [actualUvr, actualEta] = vessel.pstep({ X, pos, dT, delta, psi, water_depth: h, mode: IntegrationMode.TRAPEZOIDAL });
    expectArraysToBeClose(actualUvr, expectedUvr, 5);
    expectArraysToBeClose(actualEta, expectedEta, 5);
  });

  it('performs pstep in RK4 mode correctly', () => {
    const X = [2.0, 0.1, 0.05];
    const pos = [0.0, 0.0];
    const psi = 0.0;
    const delta = 0.17453292519943295;
    const h = 15.0;
    const dT = 1.0;

    const expectedUvr = [
      2.0137170553207397,
      0.07512024082243443,
      0.042692707106471064
    ];
    const expectedEta = [
      2.0043768882751465,
      -0.1351604163646698,
      0.04610488563776016
    ];

    const [actualUvr, actualEta] = vessel.pstep({ X, pos, dT, delta, psi, water_depth: h, mode: IntegrationMode.RK4 });
    expectArraysToBeClose(actualUvr, expectedUvr, 5);
    expectArraysToBeClose(actualEta, expectedEta, 5);
  });

  it('handles current in dynamics', () => {
    const X = [2.0, 0.1, 0.05];
    const psi = 0.0;
    const delta = 0.17453292519943295;
    const h = 15.0;
    const fl_vel = 0.5;
    const fl_psi = 0.7853981633974483; // pi/4

    const expected = [0.041504697207875155, -0.0590320284931979, -0.010299852306726255];
    const actual = vessel.dynamics({ X, psi, delta, h, fl_psi, fl_vel });
    expectArraysToBeClose(actual, expected, 5);
  });

  describe('Errors', () => {
    it('throws error if fl_vel provided without fl_psi', () => {
      expect(() => {
        vessel.step({ X: [1, 0, 0], delta: 0, psi: 0, water_depth: 15, fl_vel: 0.5 });
      }).toThrow();
    });

    it('throws error if water_depth < threshold (dummy test)', () => {
      expect(() => {
        vessel.step({ X: [1, 0, 0], delta: 0, psi: 0, water_depth: 1.0 });
      }).toThrow();
    });

    it('throws ValueError on unknown integration mode', () => {
      expect(() => {
        vessel.pstep({ X: [1, 0, 0], pos: [0, 0], dT: 1, delta: 0, psi: 0, water_depth: 15, mode: 'INVALID' });
      }).toThrow();
    });
  });
});
