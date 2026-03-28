import { vec3 } from 'gl-matrix';

/**
 * Calculates the propeller forces in the MMG model.
 * @param {MMGVessel} p Vessel parameters.
 * @param {number} u Surge velocity.
 * @param {number} nps Propeller revolutions per second.
 * @param {number} beta_P Drift angle at propeller position.
 * @returns {Object} { X_P, w_P, K_T, J }
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

    const X_P = (1 - p.t_P) * p.rho * K_T * nps * Math.abs(nps) * (p.D_p ** 4);

    return {
        X_P,
        w_P,
        K_T,
        J
    };
};
