import { VesselProfile } from './types.js';

const degToRad = (degrees: number): number => degrees * (Math.PI / 180);

export const navy44: VesselProfile = {
  id: 'navy_44_mk2',
  name: 'Navy 44 (13.4m / 44ft)',
  defaultZoom: 1.3,
  defaultZoomMobile: 1.3,
  physicsVesselData: {
    // Navy 44 Mk II powered-maneuvering baseline.
    //
    // Geometry and propulsion are anchored to the Navy 44 technical report:
    // - Lpp uses the ORC/IMSL-style length proxy (~11.3 m)
    // - Beam, prop diameter, and gearbox are taken from the ORC/BIB-backed data
    // - Overall draft is ~2.25 m, but the MMG hull terms use an effective hull
    //   depth proxy because the deep fin keel would otherwise collapse C_b to an
    //   unrealistically low value for the sailboat-specific coefficient ranges
    //
    // Interaction and hydrodynamic coefficients are conservative first-pass
    // values chosen inside the sailboat ranges doc, biased toward a heavier
    // shaft-drive monohull with a feathering prop and a balanced spade rudder.
    C_b: 0.356,
    Lpp: 11.312,
    B: 3.831,
    d: 0.78,
    displ: 12334 / 1025.0,
    w_P0: 0.12,
    J_int: 0.28,
    J_slo: -0.30,
    x_G: -0.45,
    x_P: -5.656,
    D_p: 0.489,
    k_0: 0.26,
    k_1: -0.24,
    k_2: -0.10,
    C_1: 2.0,
    C_2_plus: 1.6,
    C_2_minus: 1.2,
    l_R: -0.49,
    gamma_R_plus: 0.72,
    gamma_R_minus: 0.62,
    eta: 0.62,
    kappa: 0.55,
    A_R: 0.86,
    epsilon: 0.98,
    f_alpha: 3.5,
    rho: 1025.0,
    rho_air: 1.225,
    A_Fw: 16.0,
    A_Lw: 24.0,
    t_R: 0.18,
    t_P: 0.09,
    x_H_dash: -0.44,
    a_H: 0.18,
    m_x_dash: 0.03,
    m_y_dash: 0.24,
    R_0_dash: 0.026,
    X_vv_dash: -0.05,
    X_vr_dash: 0.01,
    X_rr_dash: 0.004,
    X_vvvv_dash: 0.82,
    Y_v_dash: -0.48,
    Y_r_dash: 0.09,
    Y_vvv_dash: -2.1,
    Y_vvr_dash: 0.28,
    Y_vrr_dash: -0.32,
    Y_rrr_dash: -0.01,
    N_v_dash: -0.16,
    N_r_dash: -0.07,
    N_vvv_dash: -0.04,
    N_vvr_dash: -0.24,
    N_vrr_dash: 0.05,
    N_rrr_dash: -0.015,
    J_z_dash: 0.012,
    // The BIB explicitly notes that the Navy 44 is a typical single
    // right-hand-screw vessel that backs to port.
    prop_walk_handedness: 'RH',
    prop_walk_ahead_coeff: 0.0,
    prop_walk_astern_coeff: 0.14,
    prop_walk_decay_j0: 0.35,
    prop_walk_decay_power: 2.0,
    prop_walk_max_ratio: 0.18,
    prop_walk_nps_deadband: 0.10,
    prop_walk_yaw_arm: 0.12,
    // Max-Prop feathering props retain materially better reverse bite than the
    // folding-prop J/105 baseline, so astern thrust is only moderately derated.
    astern_thrust_scale: 0.72,
  },
  dimensions: {
    length: 13.41,
    beam: 3.831,
  },
  engine: {
    maxEngineRPM: 3000,
    reductionGearRatio: 2.63,
  },
  steering: {
    maxRudderAngleRads: degToRad(35),
  },
  assets: {
    model3DPath: './assets/vessels/navy-44/model.glb',
    sprite2DPath: './assets/vessels/navy-44/navy-44-sprite.png',
  },
};
