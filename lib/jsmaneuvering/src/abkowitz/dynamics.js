import { rotpsi, angle_to_two_pi } from '../utils/common.js';
import { vec3, mat3 } from 'gl-matrix';

const _shallowWaterCorrectionFactory = (alpha, a, b, c) => {
    return (h_over_T, x) => (a * (x ** 2) + b * x + c) * (h_over_T ** (-alpha)) + 1.0;
};

const f_Xu_dot = _shallowWaterCorrectionFactory(1.717, 0.0, 0.0, 3.552);
const f_Xu = _shallowWaterCorrectionFactory(3.760, 0.186, 1.013, 1.423);
const f_Xv = _shallowWaterCorrectionFactory(3.661, -664.667, 0.0, 21.096);
const f_Xvr = _shallowWaterCorrectionFactory(2.615, -52.017, -18.278, 10.088);
const f_Xd = _shallowWaterCorrectionFactory(1.760, -0.369, -0.865, -0.264);

const f_Yv_dot = _shallowWaterCorrectionFactory(2.809, 0.0, 0.0, 4.933);
const f_Yr_dot = _shallowWaterCorrectionFactory(2.847, 0.0, 0.0, 4.297);
const f_Yv = _shallowWaterCorrectionFactory(4.315, 96.490, 24.697, 8.843);
const f_Yr = _shallowWaterCorrectionFactory(6.785, 17.440, 30.944, 7.680);
const f_Yvr = _shallowWaterCorrectionFactory(6.003, -239.093, 218.306, 148.738);
const f_Yd = _shallowWaterCorrectionFactory(4.288, -1.107, -2.781, 1.178);

const f_Nv_dot = _shallowWaterCorrectionFactory(2.846, 0.0, 0.0, 4.292);
const f_Nr_dot = _shallowWaterCorrectionFactory(2.724, 0.0, 0.0, 2.936);
const f_Nv = _shallowWaterCorrectionFactory(2.966, 47.870, 0.0, 6.268);
const f_Nr = _shallowWaterCorrectionFactory(4.353, 1.267, 2.962, 3.615);
const f_Nvr = _shallowWaterCorrectionFactory(4.721, 0.0, 0.0, 68.509);
const f_Nd = _shallowWaterCorrectionFactory(4.720, -1.218, -3.050, 0.167);

export class AbkowitzModel {
    constructor(vessel) {
        this.vessel = vessel;
    }

    dynamics({ X, psi, delta, h, fl_psi, fl_vel }) {
        const p = this.vessel;
        let [u, v, r] = X;

        if (fl_vel !== undefined && fl_psi !== undefined && fl_vel !== null && fl_psi !== null) {
            const u_c = fl_vel * Math.cos(fl_psi - psi - Math.PI);
            const v_c = fl_vel * Math.sin(fl_psi - psi - Math.PI);
            u -= u_c;
            v -= v_c;
        }

        const du = u - p.U_0;
        const h_prime = Math.min(h / p.T, 8.0);
        const U = Math.sqrt(u ** 2 + v ** 2) + 1e-6;

        const v_prime = v / U;
        const r_prime = r * p.L / U;
        const du_prime = du / U;

        const F_X = (
            (p.X_u * du_prime + p.X_uu * (du_prime ** 2)) * f_Xu(h_prime, du_prime) +
            (p.X_vv * (v_prime ** 2) + p.X_vvvv * (v_prime ** 4)) * f_Xv(h_prime, Math.abs(v_prime)) +
            (p.X_rr * (r_prime ** 2) + p.X_vr * v_prime * r_prime + p.X_vvrr * (v_prime ** 2) * (r_prime ** 2)) * f_Xvr(h_prime, Math.abs(v_prime)) +
            (p.X_dd * (delta ** 2) + p.X_udd * du_prime * (delta ** 2)) * f_Xd(h_prime, du_prime)
        );

        const F_Y = (
            (p.Y_v * v_prime + p.Y_vvv * (v_prime ** 3)) * f_Yv(h_prime, Math.abs(v_prime)) +
            (p.Y_r * r_prime + p.Y_rrr * (r_prime ** 3)) * f_Yr(h_prime, Math.abs(r_prime)) +
            (p.Y_vrr * v_prime * (r_prime ** 2) + p.Y_vvr * (v_prime ** 2) * r_prime) * f_Yvr(h_prime, Math.abs(v_prime)) +
            (p.Y_d * delta + p.Y_ddd * (delta ** 3) + p.Y_ud * du_prime * delta + p.Y_uddd * du_prime * (delta ** 3)) * f_Yd(h_prime, du_prime)
        );

        const F_N = (
            (p.N_v * v_prime + p.N_vvv * (v_prime ** 3) + p.N_vrr * v_prime * (r_prime ** 2)) * f_Nv(h_prime, Math.abs(v_prime)) +
            (p.N_r * r_prime + p.N_rrr * (r_prime ** 3)) * f_Nr(h_prime, Math.abs(r_prime)) +
            (p.N_vvr * (v_prime ** 2) * r_prime) * f_Nvr(h_prime, Math.abs(v_prime)) +
            (p.N_d * delta + p.N_ddd * (delta ** 3) + p.N_ud * du_prime * delta + p.N_uddd * du_prime * (delta ** 3)) * f_Nd(h_prime, du_prime)
        );

        const D_FORCE = 0.5 * p.rho * (U ** 2) * (p.L ** 2);
        const D_MOMENT = 0.5 * p.rho * (U ** 2) * (p.L ** 3);

        const Force = vec3.fromValues(F_X * D_FORCE, F_Y * D_FORCE, F_N * D_MOMENT);
        const I_zz = p.m * (p.r_zz ** 2);

        const am_surge = p.X_udot * 0.5 * p.rho * (p.L ** 3) * f_Xu_dot(h_prime, 0);
        const am_sway_v = p.Y_vdot * 0.5 * p.rho * (p.L ** 3) * f_Yv_dot(h_prime, 0);
        const am_sway_r = p.Y_rdot * 0.5 * p.rho * (p.L ** 4) * f_Yr_dot(h_prime, 0);
        const am_yaw_v = p.N_vdot * 0.5 * p.rho * (p.L ** 4) * f_Nv_dot(h_prime, 0);
        const am_yaw_r = p.N_rdot * 0.5 * p.rho * (p.L ** 5) * f_Nr_dot(h_prime, 0);

        // gl-matrix mat3 is col-major
        const M = mat3.fromValues(
            p.m - am_surge, 0, 0,
            0, p.m - am_sway_v, p.m * p.x_G - am_yaw_v,
            0, p.m * p.x_G - am_sway_r, I_zz - am_yaw_r
        );
        
        const M_inv = mat3.create();
        mat3.invert(M_inv, M);

        const RHS = vec3.fromValues(
            Force[0] + p.m * v * r + p.m * p.x_G * (r ** 2),
            Force[1] - p.m * u * r,
            Force[2] - p.m * p.x_G * u * r
        );

        const res = vec3.create();
        vec3.transformMat3(res, RHS, M_inv);
        return Array.from(res);
    }

    step({ X, delta, psi, water_depth, fl_psi, fl_vel }) {
        if (fl_vel !== undefined && fl_vel !== null && fl_psi === undefined) {
             throw new Error('LogicError: No current direction specified.');
        }
        if (water_depth !== undefined && water_depth !== null && water_depth < this.vessel.T) {
            throw new Error('LogicError: Water depth cannot be less than ship draft.');
        }

        return this.dynamics({ X, delta, psi, h: water_depth, fl_psi, fl_vel });
    }

    pstep({ X, pos, dT, delta, psi, water_depth, fl_psi, fl_vel, mode }) {
        if (mode === 'RK4') {
            return this._impl_pstep_rk4({ X, pos, dT, delta, psi, water_depth, fl_psi, fl_vel });
        } else if (mode === 'RK4' || !mode || mode === 'TRAPEZOIDAL') {
            return this._impl_pstep_trapezoidal({ X, pos, dT, delta, psi, water_depth, fl_psi, fl_vel });
        } else {
            throw new Error(`Unknown integration mode: ${mode}`);
        }
    }

    _impl_pstep_trapezoidal({ X, pos, dT, delta, psi, water_depth, fl_psi, fl_vel }) {
        const old_uvr = [...X];
        const uvr_dot = this.step({ X, delta, psi, water_depth, fl_psi, fl_vel });
        
        const new_uvr = old_uvr.map((v, i) => v + uvr_dot[i] * dT);
        
        const r_old = old_uvr[2];
        const r_new = new_uvr[2];
        const new_psi = psi + 0.5 * (r_old + r_new) * dT;

        const rot_old = rotpsi(psi, Math.PI / 2);
        const rot_new = rotpsi(new_psi, Math.PI / 2);

        const m_old = mat3.fromValues(
            rot_old[0][0], rot_old[1][0], rot_old[2][0],
            rot_old[0][1], rot_old[1][1], rot_old[2][1],
            rot_old[0][2], rot_old[1][2], rot_old[2][2]
        );
        const m_new = mat3.fromValues(
            rot_new[0][0], rot_new[1][0], rot_new[2][0],
            rot_new[0][1], rot_new[1][1], rot_new[2][1],
            rot_new[0][2], rot_new[1][2], rot_new[2][2]
        );

        const old_earth_dot = vec3.create();
        vec3.transformMat3(old_earth_dot, vec3.fromValues(...old_uvr), m_old);

        const new_earth_dot = vec3.create();
        vec3.transformMat3(new_earth_dot, vec3.fromValues(...new_uvr), m_new);

        const new_N = pos[0] + 0.5 * (old_earth_dot[1] + new_earth_dot[1]) * dT;
        const new_E = pos[1] + 0.5 * (old_earth_dot[0] + new_earth_dot[0]) * dT;

        const new_eta = [new_N, new_E, angle_to_two_pi(new_psi)];
        return [new_uvr, new_eta];
    }

    _impl_pstep_rk4({ X, pos, dT, delta, psi, water_depth, fl_psi, fl_vel }) {
        const full_state = [...pos, psi, ...X];
        const ext_dyn = (state) => {
            const [N, E, p_psi, u, v, r] = state;
            const uvr = [u, v, r];
            const uvr_dot = this.dynamics({ X: uvr, delta, h: water_depth, psi: p_psi, fl_psi, fl_vel });
            const rot = rotpsi(p_psi, Math.PI / 2);
            const m = mat3.fromValues(
                rot[0][0], rot[1][0], rot[2][0],
                rot[0][1], rot[1][1], rot[2][1],
                rot[0][2], rot[1][2], rot[2][2]
            );
            const earth_dot = vec3.create();
            vec3.transformMat3(earth_dot, vec3.fromValues(...uvr), m);
            return [earth_dot[1], earth_dot[0], uvr[2], ...uvr_dot];
        };

        const k1 = ext_dyn(full_state);
        const k2 = ext_dyn(full_state.map((v, i) => v + 0.5 * dT * k1[i]));
        const k3 = ext_dyn(full_state.map((v, i) => v + 0.5 * dT * k2[i]));
        const k4 = ext_dyn(full_state.map((v, i) => v + dT * k3[i]));

        const new_state = full_state.map((v, i) => v + (dT / 6.0) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
        new_state[2] = angle_to_two_pi(new_state[2]);

        return [new_state.slice(3), new_state.slice(0, 3)];
    }
}
