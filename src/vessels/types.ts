export interface VesselProfile {
  id: string;
  name: string;
  physicsModel?: any; // The constant from jsmaneuvering like KVLCC2_L64
  physicsVesselData?: Record<string, string | number | boolean | null>;
  physicsOverrides?: Record<string, string | number | boolean | null>;
  dimensions: {
    length: number; // meters
    beam: number; // meters
  };
  engine: {
    maxEngineRPM: number;
    reductionGearRatio: number;
    reductionGearRatioAstern?: number;
  };
  steering: {
    maxRudderAngleRads: number;
  };
  assets: {
    model3DPath: string;
    sprite2DPath: string;
  };
}
