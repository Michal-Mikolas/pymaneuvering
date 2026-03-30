// @ts-ignore
import { Vessel } from './jsmaneuvering/src/vessel.js';
import { VesselProfile } from '../src/vessels/types.js';

/**
 * Strongly-typed adapter class that acts as a bridge between the game's UI
 * and the underlying jsmaneuvering physics engine.
 */
export class BoatController {
  public position = { x: 0, y: 0, z: 0 };
  public pivotPoint: { x: number, y: number, z: number } | null = null;
  public rotationY = 0;
  public currentEngineRPM = 0;
  public currentSpeed = 0; // Speed in m/s (surge)

  // Internal physics state
  private vessel: any;
  private uvr: [number, number, number] = [0, 0, 0];
  private pos: [number, number] = [0, 0];
  private psi = 0;

  // Inputs
  private throttle = 0;
  private steering = 0;

  constructor(public readonly profile: VesselProfile) {
    if (profile.physicsVesselData) {
      this.vessel = new Vessel({
        vessel_data: {
          ...profile.physicsVesselData,
          ...(profile.physicsOverrides ?? {}),
        },
      });
    } else {
      const baseVessel = new Vessel({ new_from: profile.physicsModel });
      this.vessel = profile.physicsOverrides
        ? new Vessel({
            vessel_data: {
              ...baseVessel.vessel,
              ...profile.physicsOverrides,
            },
          })
        : baseVessel;
    }
    
    // Initialize starting state to something reasonable if needed, 
    // but default is 0 for everything as per requirements.
    this.uvr = [0, 0, 0];
    this.pos = [0, 0];
    this.psi = 0;
  }

  /**
   * Sets the control inputs for the boat.
   * @param throttle Normalized throttle value between -1.0 and 1.0.
   * @param steering Normalized steering value between -1.0 and 1.0.
   */
  public setControls(throttle: number, steering: number): void {
    this.throttle = Math.max(-1, Math.min(1, throttle));
    this.steering = Math.max(-1, Math.min(1, steering));
  }

  /**
   * Updates the boat's physics state and transforms it to WebGL coordinates.
   * @param dt Time step in seconds.
   */
  public update(dt: number): void {
    const gearRatio = this.throttle < 0
      ? (this.profile.engine.reductionGearRatioAstern ?? this.profile.engine.reductionGearRatio)
      : this.profile.engine.reductionGearRatio;
    const maxPropellerNPS = (this.profile.engine.maxEngineRPM / gearRatio) / 60.0;
    const nps = this.throttle * maxPropellerNPS;
    this.currentEngineRPM = this.throttle * this.profile.engine.maxEngineRPM;
    const delta = this.steering * this.profile.steering.maxRudderAngleRads;

    // Call the physics engine's pstep() method
    // We use a default water_depth of 15m (typical for tanker tests)
    const [new_uvr, new_eta] = this.vessel.pstep({
      X: this.uvr,
      pos: this.pos,
      dT: dt,
      nps,
      delta,
      psi: this.psi,
      water_depth: 15.0 
    });

    // Update internal state
    this.uvr = new_uvr;
    this.pos = [new_eta[0], new_eta[1]];
    this.psi = new_eta[2];

    // Coordinate Mapping:
    // Maritime outputs to WebGL Y-up coordinates:
    // position.x = Easting (Physics new_eta[1])
    // position.y = 0
    // position.z = -Northing (Physics -new_eta[0])
    // rotationY = -Heading (Physics -new_eta[2])
    this.position.x = this.pos[1];
    this.position.y = 0;
    this.position.z = -this.pos[0];
    this.rotationY = -this.psi;
    this.currentSpeed = this.uvr[0];

    const pivotPoint = this.vessel.getPivotPoint?.();
    this.pivotPoint = pivotPoint
      ? {
          x: pivotPoint.world.east,
          y: 0,
          z: -pivotPoint.world.north,
        }
      : null;
  }
}
