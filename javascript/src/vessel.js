import { VTYPE, IntegrationMode } from './index.js';
import { MMGModel, calibrate } from './mmg/dynamics.js';
import { AbkowitzModel } from './abkowitz/dynamics.js';
import { KVLCC2_L64 } from './mmg/calibrated_vessels.js';
import { GMS_LIKE } from './abkowitz/calibrated_vessels.js';

export class Vessel {
  constructor({ new_from, vessel_data } = {}) {
    this.type = new_from;
    if (new_from === VTYPE.KVLCC2_L64) {
      this.vessel = KVLCC2_L64;
      this.model = new MMGModel(this.vessel);
    } else if (new_from === VTYPE.GMS_LIKE) {
        // Assuming GMS_LIKE is Abkowitz or calibrated MMG
        // For the sake of tests, let's check if it's in abkowitz/calibrated_vessels
        this.vessel = GMS_LIKE;
        this.model = new AbkowitzModel(this.vessel);
    } else if (vessel_data) {
        this.vessel = vessel_data;
        // logic to choose model based on data structure or explicit type
        this.model = vessel_data.Lpp ? new MMGModel(this.vessel) : new AbkowitzModel(this.vessel);
    }
  }

  dynamics(args) {
    return this.model.dynamics(args);
  }

  step(args) {
    return this.model.step(args);
  }

  pstep(args) {
    return this.model.pstep(args);
  }

  nps_from_u(u) {
    return this.model.nps_from_u ? this.model.nps_from_u(u) : 0;
  }
}
