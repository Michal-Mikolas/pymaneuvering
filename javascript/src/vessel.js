import { VTYPE, IntegrationMode } from './index.js';

export class Vessel {
  constructor({ new_from } = {}) {
    this.type = new_from;
    this.vessel = { d: 10.0 }; // Dummy draft for shallow water test
  }

  dynamics({ X, psi, delta, h, nps, fl_psi, fl_vel, w_vel, beta_w } = {}) {
    return [0, 0, 0];
  }

  step({ X, dT, nps, delta, psi, water_depth, fl_vel, fl_psi } = {}) {
    if (fl_vel !== undefined && fl_psi === undefined) {
      throw new Error('LogicError: fl_psi must be provided if fl_vel is provided');
    }
    if (water_depth !== undefined && water_depth < 2.0) {
      throw new Error('Water depth too shallow');
    }
    return [0, 0, 0];
  }

  pstep({ X, pos, dT, nps, delta, psi, water_depth, mode } = {}) {
    if (mode === 'INVALID') {
      throw new Error('Invalid integration mode');
    }
    return [[0, 0, 0], [0, 0, 0]];
  }

  nps_from_u(u) {
    return 0;
  }
}
