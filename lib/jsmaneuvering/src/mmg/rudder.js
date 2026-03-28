import { vec3 } from 'gl-matrix';

/**
 * Calculates the rudder forces in the MMG model.
 * @param {MMGVessel} p Vessel parameters.
 * @param {number} delta Rudder angle [rad].
 * @param {number} u Surge velocity.
 * @param {number} U Overall speed.
 * @param {number} beta Drift angle at midship.
 * @param {number} r_dash Non-dimensionalized yaw rate.
 * @param {number} w_P Wake fraction at propeller.
 * @param {number} J Propeller advance ratio.
 * @param {number} K_T Propeller thrust coefficient.
 * @returns {vec3} Force vector [X_R, Y_R, N_R].
 */
export const rudderForces = (p, delta, u, U, beta, r_dash, w_P, J, K_T) => {
    // When u < 0, the standard beta = atan2(-v, u) ≈ π even with zero sway,
    // causing a massive fictitious v_R. Use atan2(-v, |u|) equivalent so that
    // straight-astern motion produces zero lateral inflow on the rudder.
    // For forward motion (u >= 0), beta_eff === beta identically.
    const beta_eff = (u < 0) ? Math.atan2(Math.sin(beta), -Math.cos(beta)) : beta;
    const beta_R = beta_eff - p.l_R * r_dash;

    let gamma_R;
    if (p.gamma_R !== undefined && p.gamma_R !== null && p.gamma_R !== 0) {
        gamma_R = p.gamma_R;
    } else {
        gamma_R = beta_R < 0.0 ? p.gamma_R_minus : p.gamma_R_plus;
    }

    const v_R = U * gamma_R * beta_R;

    let u_R = 0;
    if (u < 0) {
        // In reverse, prop wash is directed toward the bow, not over the rudder.
        // The rudder only feels the ambient water flow.
        u_R = u * (1 - w_P);
    } else if (J !== 0) {
        const term1 = 8.0 * K_T / (Math.PI * (J ** 2));
        const sqrt_arg = 1.0 + term1;
        const term2 = 1.0 + p.kappa * (Math.sqrt(Math.max(0, sqrt_arg)) - 1);
        u_R = u * (1 - w_P) * p.epsilon * Math.sqrt(
            p.eta * (term2 ** 2) + (1 - p.eta)
        );
    }

    const U_R = Math.sqrt((u_R ** 2) + (v_R ** 2));

    let alpha_R;
    if (p.delta_prop !== undefined && p.delta_prop !== null && p.delta_prop !== 0) {
        alpha_R = (u_R !== 0)
            ? delta - p.delta_prop - v_R / u_R
            : delta - p.delta_prop;
    } else {
        alpha_R = delta - Math.atan2(v_R, u_R);
    }

    let F_N;
    if (p.A_R !== undefined && p.A_R !== null && p.A_R !== 0) {
        F_N = 0.5 * p.A_R * p.rho * p.f_alpha * (U_R ** 2) * Math.sin(alpha_R);
    } else {
        F_N = 0.5 * p.A_R_Ld_em * (p.Lpp * p.d * p.rho) * p.f_alpha * (U_R ** 2) * Math.sin(alpha_R);
    }

    const X_R = -(1 - p.t_R) * F_N * Math.sin(delta);
    const Y_R = -(1 + p.a_H) * F_N * Math.cos(delta);
    
    const x_H = p.x_H_dash * p.Lpp;
    const N_R = -(-0.5 * p.Lpp + p.a_H * x_H) * F_N * Math.cos(delta);

    return vec3.fromValues(X_R, Y_R, N_R);
};
