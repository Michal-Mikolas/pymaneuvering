import { vec3 } from 'gl-matrix';

const DEFAULT_PROP_WALK_DECAY_POWER = 2.0;

const propWalkHandednessSign = (handedness) => {
    if (typeof handedness === 'string') {
        const normalized = handedness.trim().toUpperCase();
        if (normalized === 'RH') {
            return 1;
        }
        if (normalized === 'LH') {
            return -1;
        }
    }

    if (handedness === 1 || handedness === -1) {
        return handedness;
    }

    return 0;
};

const propWalkDecay = (p, J) => {
    const decayJ0 = p.prop_walk_decay_j0;
    if (!(decayJ0 > 0)) {
        return 1.0;
    }

    const decayPower = p.prop_walk_decay_power > 0
        ? p.prop_walk_decay_power
        : DEFAULT_PROP_WALK_DECAY_POWER;

    return 1.0 / (1.0 + ((Math.abs(J) / decayJ0) ** decayPower));
};

const propellerWalkForces = (p, X_P, nps, J) => {
    const npsDeadband = Math.max(0.0, p.prop_walk_nps_deadband ?? 0.0);
    if (Math.abs(nps) <= npsDeadband || X_P === 0.0) {
        return { Y_P: 0.0, N_P: 0.0 };
    }

    const handedness = propWalkHandednessSign(p.prop_walk_handedness);
    if (handedness === 0) {
        return { Y_P: 0.0, N_P: 0.0 };
    }

    const baseCoeff = nps >= 0
        ? (p.prop_walk_ahead_coeff ?? 0.0)
        : (p.prop_walk_astern_coeff ?? 0.0);

    if (baseCoeff === 0.0) {
        return { Y_P: 0.0, N_P: 0.0 };
    }

    const ratioLimit = p.prop_walk_max_ratio > 0
        ? p.prop_walk_max_ratio
        : Number.POSITIVE_INFINITY;
    const decay = propWalkDecay(p, J);
    const ratio = Math.min(Math.abs(baseCoeff) * decay, ratioLimit);
    const direction = handedness * Math.sign(nps) * Math.sign(baseCoeff);
    const Y_P = ratio * Math.abs(X_P) * direction;

    const effectiveArm = p.x_P + (p.prop_walk_yaw_arm ?? 0.0);
    const N_P = effectiveArm * Y_P;

    return { Y_P, N_P };
};

/**
 * Calculates the propeller forces in the MMG model.
 * @param {MMGVessel} p Vessel parameters.
 * @param {number} u Surge velocity.
 * @param {number} nps Propeller revolutions per second.
 * @param {number} beta_P Drift angle at propeller position.
 * @returns {Object} { X_P, Y_P, N_P, w_P, K_T, J }
 */
export const propellerForces = (p, u, nps, beta_P) => {
    let w_P;
    if (p.C_1 !== undefined && p.C_2_plus !== undefined && p.C_2_minus !== undefined &&
        p.C_1 !== 0 && p.C_2_plus !== 0 && p.C_2_minus !== 0) {
        const C_2 = beta_P >= 0 ? p.C_2_plus : p.C_2_minus;
        const tmp = 1 - Math.exp(-p.C_1 * Math.abs(beta_P)) * (C_2 - 1);
        w_P = 1 - (1 - p.w_P0) * (1 + tmp);
    } else {
        w_P = p.w_P0 * Math.exp(-4.0 * (beta_P ** 2));
    }

    // In reverse, the stern moves into undisturbed water. The forward-fitted
    // wake fraction model is not valid. Set w_P = 0 (no wake deficit).
    if (u < 0) {
        w_P = 0;
    }

    let J = 0;
    if (nps !== 0) {
        J = (1 - w_P) * u / (nps * p.D_p);
    }

    let K_T;
    if (p.k_0 !== undefined && p.k_1 !== undefined && p.k_2 !== undefined &&
        (p.k_0 !== 0 || p.k_1 !== 0 || p.k_2 !== 0)) {
        K_T = p.k_0 + (p.k_1 * J) + (p.k_2 * (J ** 2));
    } else {
        K_T = p.J_slo * J + p.J_int;
    }

    if (nps < 0) {
        const asternScale = p.astern_thrust_scale ?? 1.0;
        K_T *= asternScale;
    }

    const X_P = (1 - p.t_P) * p.rho * K_T * nps * Math.abs(nps) * (p.D_p ** 4);
    const { Y_P, N_P } = propellerWalkForces(p, X_P, nps, J);

    return {
        X_P,
        Y_P,
        N_P,
        w_P,
        K_T,
        J
    };
};
