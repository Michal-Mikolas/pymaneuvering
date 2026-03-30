const TANKER_REFERENCE_LENGTH = 64.0;
const TANKER_REFERENCE_FRUSTUM_SIZE = 150.0;
const MOBILE_PHONE_MAX_WIDTH = 768;
const MOBILE_DEFAULT_ZOOM_MULTIPLIER = 1.4;

export function getDefaultFrustumSizeForVesselLength(length: number): number {
  if (!Number.isFinite(length) || length <= 0) {
    return TANKER_REFERENCE_FRUSTUM_SIZE;
  }

  return (length / TANKER_REFERENCE_LENGTH) * TANKER_REFERENCE_FRUSTUM_SIZE;
}

export function getDefaultZoomMultiplierForViewport(
  width: number,
  height: number,
  coarsePointer: boolean
): number {
  if (
    coarsePointer &&
    Number.isFinite(width) &&
    Number.isFinite(height) &&
    width <= MOBILE_PHONE_MAX_WIDTH
  ) {
    return MOBILE_DEFAULT_ZOOM_MULTIPLIER;
  }

  return 1;
}
