import { j105 } from './j105.js';
import { tanker } from './tanker.js';
import { VesselProfile } from './types.js';

export const availableVessels: VesselProfile[] = [tanker, j105];

export function getVesselById(id: string): VesselProfile | undefined {
  return availableVessels.find((vessel) => vessel.id === id);
}
