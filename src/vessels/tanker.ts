import { VTYPE } from '../../lib/jsmaneuvering/src/index.js';
import { VesselProfile } from './types.js';

export const tanker: VesselProfile = {
  id: 'kvlcc2_tanker',
  name: 'KVLCC2 Tanker',
  physicsModel: VTYPE.KVLCC2_L64,
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
    model3DPath: '/assets/vessels/tanker/model.glb',  // "assets" folder lives inside "/public" folder
    sprite2DPath: '/assets/vessels/tanker/sprite.png'   // "assets" folder lives inside "/public" folder
  }
};
