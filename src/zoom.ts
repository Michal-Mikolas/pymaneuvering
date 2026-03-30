const TANKER_REFERENCE_LENGTH = 64.0;
const TANKER_REFERENCE_FRUSTUM_SIZE = 150.0;

export function getDefaultFrustumSizeForVesselLength(length: number): number {
  if (!Number.isFinite(length) || length <= 0) {
    return TANKER_REFERENCE_FRUSTUM_SIZE;
  }

  return (length / TANKER_REFERENCE_LENGTH) * TANKER_REFERENCE_FRUSTUM_SIZE;
}
