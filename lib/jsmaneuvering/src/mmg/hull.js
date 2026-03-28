import { vec3 } from 'gl-matrix';

/**
 * Calculates the hydrodynamic forces acting on the ship hull in the MMG model.
 * @param {MMGVessel} p Vessel parameters.
 * @param {number} u Surge velocity.
 * @param {number} v_m Lateral velocity at midship.
 * @param {number} r Yaw rate.
 * @param {number} U Overall speed.
 * @param {number} v_dash Non-dimensionalized lateral velocity.
 * @param {number} r_dash Non-dimensionalized yaw rate.
 * @returns {vec3} Force vector [X_H, Y_H, N_H].
 */
export const hullForces = (p, u, v_m, r, U, v_dash, r_dash) => {
    const rho = p.rho;
    const Lpp = p.Lpp;
    const d = p.d;
    const U2 = U * U;

    // sign_u ensures the calm-water resistance R'₀ always opposes motion.
    // The other terms (X_vv, X_rr, etc.) are even-powered and naturally direction-invariant.
    const sign_u = u >= 0 ? 1 : -1;

    const X_H = 0.5 * rho * Lpp * d * U2 * (
        - p.R_0_dash * sign_u
        + p.X_vv_dash * (v_dash ** 2)
        + p.X_vr_dash * v_dash * r_dash
        + p.X_rr_dash * (r_dash ** 2)
        + p.X_vvvv_dash * (v_dash ** 4)
    );

    const Y_H = 0.5 * rho * Lpp * d * U2 * (
        p.Y_v_dash * v_dash
        + p.Y_r_dash * r_dash
        + p.Y_vvv_dash * (v_dash ** 3)
        + p.Y_vvr_dash * (v_dash ** 2) * r_dash
        + p.Y_vrr_dash * v_dash * (r_dash ** 2)
        + p.Y_rrr_dash * (r_dash ** 3)
    );

    const N_H = 0.5 * rho * (Lpp ** 2) * d * U2 * (
        p.N_v_dash * v_dash
        + p.N_r_dash * r_dash
        + p.N_vvv_dash * (v_dash ** 3)
        + p.N_vvr_dash * (v_dash ** 2) * r_dash
        + p.N_vrr_dash * v_dash * (r_dash ** 2)
        + p.N_rrr_dash * (r_dash ** 3)
    );

    return vec3.fromValues(X_H, Y_H, N_H);
};
