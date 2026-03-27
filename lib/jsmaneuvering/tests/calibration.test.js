import { calibrate } from '../src/mmg/dynamics.js';
import { MinimalVessel } from '../src/utils/common.js';

describe('MMG Calibration', () => {
  it('calibrates MMG model from MinimalVessel', () => {
    const min_v = new MinimalVessel({
      m: 0.1, C_b: 0.8, Lpp: 100.0, B: 20.0, d: 10.0,
      eta: 0.5, A_R: 15.0, D_p: 5.0, f_alpha: 2.5, x_G: 0.0
    });

    const calibrated = calibrate(min_v, 1025.0);

    // Check key mapped/calculated fields
    expect(calibrated.displ).toBeCloseTo(0.1, 5);
    expect(calibrated.m_x_dash).toBeCloseTo(0.0, 5);
    expect(calibrated.Y_v_dash).toBeCloseTo(0.0, 5);
    expect(calibrated.rho).toBe(1025.0);
    expect(calibrated.rho_air).toBe(1.225);
    expect(calibrated.Lpp).toBe(100.0);
  });
});
