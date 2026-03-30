import { getDefaultFrustumSizeForVesselLength } from '../src/zoom.js';

describe('getDefaultFrustumSizeForVesselLength', () => {
  it('keeps the tanker zoom unchanged at the current baseline', () => {
    expect(getDefaultFrustumSizeForVesselLength(64)).toBeCloseTo(150, 5);
  });

  it('scales the default zoom proportionally with vessel length', () => {
    expect(getDefaultFrustumSizeForVesselLength(10.57)).toBeCloseTo((10.57 / 64) * 150, 5);
  });

  it('falls back to the tanker baseline for invalid lengths', () => {
    expect(getDefaultFrustumSizeForVesselLength(0)).toBeCloseTo(150, 5);
    expect(getDefaultFrustumSizeForVesselLength(Number.NaN)).toBeCloseTo(150, 5);
  });
});
