import { getDefaultZoomMultiplierForViewport } from '../src/zoom.js';

describe('getDefaultZoomMultiplierForViewport', () => {
  it('zooms out more by default on phone-sized touch viewports', () => {
    expect(getDefaultZoomMultiplierForViewport(390, 844, true)).toBeGreaterThan(1);
  });

  it('keeps the desktop default zoom on larger or non-touch viewports', () => {
    expect(getDefaultZoomMultiplierForViewport(1280, 800, false)).toBe(1);
    expect(getDefaultZoomMultiplierForViewport(1024, 1366, true)).toBe(1);
  });
});
