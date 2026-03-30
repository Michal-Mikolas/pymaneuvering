import { VTYPE } from '../../lib/jsmaneuvering/src/index.js';
import { VesselProfile } from './types.js';

export const tanker: VesselProfile = {
  id: 'kvlcc2_tanker',
  name: 'KVLCC2 Tanker',
  defaultZoom: 0.8,
  defaultZoomMobile: 0.8,
  physicsModel: VTYPE.KVLCC2_L64,
  physicsOverrides: {
    // Research supports RH handedness directly; the remaining values are a
    // conservative KVLCC2-specific initial calibration, not a benchmark truth.
    prop_walk_handedness: 'RH',
    prop_walk_ahead_coeff: 0.0,
    prop_walk_astern_coeff: 0.10,
    prop_walk_decay_j0: 0.30,
    prop_walk_decay_power: 2.0,
    prop_walk_yaw_arm: 0.0,
  },
  dimensions: {
    length: 64.0,
    beam: 11.6
  },
  engine: {
    maxEngineRPM: 450,
    reductionGearRatio: 1.0
  },
  steering: {
    maxRudderAngleRads: 35 * (Math.PI / 180)
  },
  assets: {
    model3DPath: './assets/vessels/tanker/model.glb',  // "assets" folder lives inside "/public" folder
    sprite2DPath: './assets/vessels/tanker/sprite.png'   // "assets" folder lives inside "/public" folder
  }
};
