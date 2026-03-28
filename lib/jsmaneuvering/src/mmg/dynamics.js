import { MMGVessel, rotpsi, angle_to_two_pi } from '../utils/common.js';
import { hullForces } from './hull.js';
import { propellerForces } from './propeller.js';
import { rudderForces } from './rudder.js';
import { vec3, mat3 } from 'gl-matrix';

export const calibrate = (v, rho) => {
  // Deep copy/clone structure
  const vessel = JSON.parse(JSON.stringify(v));
  
  const L = vessel.Lpp;
  
  if (vessel.x_G === undefined || vessel.x_G === null) {
      vessel.x_G = 0.0;
  }
  
  vessel.x_P = -0.5 * L;
  vessel.rho = rho;

  if (vessel.rho_air === undefined || vessel.rho_air === null) vessel.rho_air = 1.225;
  if (vessel.A_Fw === undefined || vessel.A_Fw === null) vessel.A_Fw = 0.0;
  if (vessel.A_Lw === undefined || vessel.A_Lw === null) vessel.A_Lw = 0.0;
  if (vessel.C_1 === undefined || vessel.C_1 === null) vessel.C_1 = 2.0;
  if (vessel.C_2_plus === undefined || vessel.C_2_plus === null) vessel.C_2_plus = 1.6;
  if (vessel.C_2_minus === undefined || vessel.C_2_minus === null) vessel.C_2_minus = 1.1;
  if (vessel.delta_prop === undefined || vessel.delta_prop === null) vessel.delta_prop = 0.0;
  
  // Displacement mapping
  vessel.displ = vessel.m;

  const required_fields = [
    "rho", "rho_air", "C_b", "Lpp", "B", "d", "w_P0", "x_G", "x_P", "D_p",
    "l_R", "eta", "kappa", "A_R", "epsilon", "t_R", "t_P", "x_H_dash", "a_H",
    "A_Fw", "A_Lw", "R_0_dash", "X_vv_dash", "X_vr_dash", "X_rr_dash",
    "X_vvvv_dash", "Y_v_dash", "Y_r_dash", "Y_vvv_dash", "Y_vvr_dash",
    "Y_vrr_dash", "Y_rrr_dash", "N_v_dash", "N_r_dash", "N_vvv_dash",
    "N_vvr_dash", "N_vrr_dash", "N_rrr_dash", "displ", "m_x_dash",
    "m_y_dash", "J_z_dash", "k_0", "k_1", "k_2", "C_1", "C_2_plus",
    "C_2_minus", "J_slo", "J_int", "gamma_R_plus", "gamma_R_minus", "f_alpha"
  ];

  required_fields.forEach(field => {
    if (vessel[field] === undefined || vessel[field] === null) {
      vessel[field] = 0.0;
    }
  });

  return new MMGVessel(vessel);
};

export class MMGModel {
  constructor(vessel) {
    this.vessel = vessel;
  }

  dynamics({ X, psi, delta, h, nps, fl_psi, fl_vel, w_vel, beta_w }) {
    let p = this.vessel;

    if (h !== undefined && h !== null) {
      p = this._shallowWaterHdm(h);
    }

    const [u, v_m, r] = X;
    let u_pure = u;
    let vm_pure = v_m;
    let u_r = u;
    let v_r = v_m;

    let u_curr = 0;
    let v_curr = 0;

    if (fl_vel !== undefined && fl_psi !== undefined && fl_vel !== null && fl_psi !== null) {
      u_curr = fl_vel * Math.cos(fl_psi - psi - Math.PI);
      v_curr = fl_vel * Math.sin(fl_psi - psi - Math.PI);
      u_r = u - u_curr;
      v_r = v_m - v_curr;
    }

    const current_u = (fl_vel !== undefined && fl_vel !== null) ? u_r : u;
    const current_v = (fl_vel !== undefined && fl_vel !== null) ? v_r : v_m;

    const U = Math.sqrt(current_u ** 2 + current_v ** 2);
    let beta = 0;
    let v_dash = 0;
    let r_dash = 0;

    if (U !== 0) {
      beta = Math.atan2(-current_v, current_u);
      // Use sign(u) so hull-polynomial damping terms always oppose motion.
      // When u > 0, sign = +1 → identical to v/U. When u < 0, sign = -1 → flips
      // v_dash and r_dash so polynomials fitted for forward motion still damp correctly.
      const sign_u = current_u >= 0 ? 1 : -1;
      v_dash = current_v / U * sign_u;
      r_dash = r * p.Lpp / U * sign_u;
    }

    const beta_P = beta - (p.x_P / p.Lpp) * r_dash;
    
    const { X_P, w_P, K_T, J } = propellerForces(p, current_u, nps, beta_P);
    const [X_H, Y_H, N_H] = hullForces(p, current_u, current_v, r, U, v_dash, r_dash);
    const [X_R, Y_R, N_R] = rudderForces(p, delta, current_u, U, beta, r_dash, w_P, J, K_T);

    let X_W = 0, Y_W = 0, N_W = 0;
    if (w_vel !== 0 && w_vel !== undefined && beta_w !== undefined && w_vel !== null && beta_w !== null) {
      const u_w = w_vel * Math.cos(beta_w - psi);
      const v_w = w_vel * Math.sin(beta_w - psi);
      const u_rw = u - u_w;
      const v_rw = v_m - v_w;
      const V_rw_sq = u_rw ** 2 + v_rw ** 2;
      const g_rw = -Math.atan2(v_rw, u_rw);

      X_W = 0.5 * p.rho_air * V_rw_sq * this._cXWind(g_rw) * p.A_Fw;
      Y_W = 0.5 * p.rho_air * V_rw_sq * this._cYWind(g_rw) * p.A_Lw;
      N_W = 0.5 * p.rho_air * V_rw_sq * this._cNWind(g_rw) * p.A_Lw * p.Lpp;
    }

    const m_x = p.m_x_dash * (0.5 * p.rho * (p.Lpp ** 2) * p.d);
    const m_y = p.m_y_dash * (0.5 * p.rho * (p.Lpp ** 2) * p.d);
    const J_z = p.J_z_dash * (0.5 * p.rho * (p.Lpp ** 4) * p.d);
    const m = p.displ * p.rho;
    const I_zG = m * (0.25 * p.Lpp) ** 2;

    const M_RB = mat3.fromValues(
      m, 0, 0,
      0, m, m * p.x_G,
      0, m * p.x_G, I_zG
    );

    const M_A = mat3.fromValues(
      m_x, 0, 0,
      0, m_y, 0,
      0, 0, J_z + (p.x_G ** 2) * m
    );

    const M_sum = mat3.create();
    mat3.add(M_sum, M_RB, M_A);
    const M_inv = mat3.create();
    mat3.invert(M_inv, M_sum);

    const FX = X_H + X_R + X_P + X_W;
    const FY = Y_H + Y_R + Y_W;
    const FN = N_H + N_R + N_W;
    const F = vec3.fromValues(FX, FY, FN);

    const C_RB = this._cRB(m, p.x_G, r);
    const C_A = this._cA(m_x, m_y, current_u, current_v);

    if (fl_vel !== undefined && fl_psi !== undefined && fl_vel !== null && fl_psi !== null) {
      const nu_c_dot = vec3.fromValues(v_curr * r, -u_curr * r, 0);
      
      const term1 = vec3.create();
      vec3.transformMat3(term1, vec3.fromValues(u_pure, vm_pure, r), C_RB);
      
      // Compute (nu_r + M_A * nu_c_dot)
      const ma_nu_c_dot = vec3.create();
      vec3.transformMat3(ma_nu_c_dot, nu_c_dot, M_A);
      
      const nu_r_plus_ma_nu_c_dot = vec3.fromValues(u_r, v_r, r);
      vec3.add(nu_r_plus_ma_nu_c_dot, nu_r_plus_ma_nu_c_dot, ma_nu_c_dot);
      
      const term2 = vec3.create();
      vec3.transformMat3(term2, nu_r_plus_ma_nu_c_dot, C_A);
      
      const rhs = vec3.create();
      vec3.sub(rhs, F, term1);
      vec3.sub(rhs, rhs, term2);
      
      const res = vec3.create();
      vec3.transformMat3(res, rhs, M_inv);
      return Array.from(res);
    } else {
      const C_sum = mat3.create();
      mat3.add(C_sum, C_RB, C_A);
      
      const term1 = vec3.create();
      vec3.transformMat3(term1, vec3.fromValues(u, v_m, r), C_sum);
      
      const rhs = vec3.create();
      vec3.sub(rhs, F, term1);
      
      const res = vec3.create();
      vec3.transformMat3(res, rhs, M_inv);
      return Array.from(res);
    }
  }

  _shallowWaterHdm(water_depth) {
    const v = JSON.parse(JSON.stringify(this.vessel));
    const { Lpp: L, B, d: T, C_b: Cb } = v;
    const H = water_depth;
    const HT = H / T - 1;
    const TH = T / H;

    const K0 = 1 + 0.0775 / (HT ** 2) - 0.011 / (HT ** 3) + 0.000068 / (HT ** 5);
    const K1 = -0.0643 / HT + 0.0724 / (HT ** 2) - 0.0113 / (HT ** 3) + 0.0000767 / (HT ** 5);
    const K2 = B / T <= 4 ? 0.0342 / HT : (0.137 * B) / (HT * T);
    const B1 = Cb * B * (1 + B / L) ** 2;

    const A1Yr = -5.5 * (Cb * B / T) ** 2 + 26 * (Cb * B / T) - 31.5;
    const A2Yr = 37 * (Cb * B / T) ** 2 - 185 * (Cb * B / T) + 230;
    const A3Yr = -38 * (Cb * B / T) ** 2 + 197 * (Cb * B / T) - 250;

    const A1Nvvr = 91 * Cb * T / B - 25;
    const A2Nvvr = -515 * Cb * T / B + 144;
    const A3Nvvr = 508 * Cb * T / B - 143;

    const A1Nvrr = 40 * Cb * B / T - 88;
    const A2Nvrr = -295 * Cb * B / T + 645;
    const A3Nvrr = 312 * Cb * B / T - 678;

    const fnr = K0 + 0.5 * K1 * B1 / T + (1/3) * K2 * (B1 / T) ** 2;
    const fyr = K0 + 0.4 * K1 * B1 / T + 24/105 * K2 * (B1 / T) ** 2;
    const fnv = K0 + K1 * B1 / T + K2 * (B1 / T) ** 2;
    const gnr = K0 + 8/15 * K1 * B1 / T + 40/105 * K2 * (B1 / T) ** 2;
    const fyv = 1.5 * fnr - 0.5;

    v.X_vv_dash *= fyv;
    v.X_vvvv_dash *= fyv;
    v.X_rr_dash *= fnr;
    v.X_vr_dash *= fyr;
    v.Y_vvv_dash *= fyv;
    v.N_v_dash *= fnv;
    v.N_vvv_dash *= fyv;
    v.Y_rrr_dash *= gnr;
    v.N_rrr_dash *= gnr;
    v.Y_vvr_dash *= fyv;
    v.Y_vrr_dash *= fyv;

    v.Y_v_dash *= (-TH + 1 / ((1 - TH) ** (0.4 * Cb * B / T)));
    v.Y_r_dash *= (1 + A1Yr * TH + A2Yr * (TH ** 2) + A3Yr * (TH ** 3));
    v.N_r_dash *= (-TH + 1 / ((1 - TH) ** (-14.28 * T / L + 1.5)));

    v.N_vvr_dash *= (1 + A1Nvvr * TH + A2Nvvr * (TH ** 2) + A3Nvvr * (TH ** 3));
    v.N_vrr_dash *= (1 + A1Nvrr * TH + A2Nvrr * (TH ** 2) + A3Nvrr * (TH ** 3));

    v.w_P0 *= (1 + (-4.932 + 0.6425 * (Cb * L / T) - 0.0165 * (Cb * L / T) ** 2) * (TH ** 1.655));
    const ctp = 1 + ((29.495 - 14.089 * (Cb * L / B) + 1.6486 * (Cb * L / B) ** 2) * (1 / 250 - 7 * TH / 200 - 13 * (TH ** 2) / 125));
    v.t_P = 1 - ctp * (1 - v.t_P);
    
    const cgr1 = 1 + ((-5129 / 500 + 178.207 * (Cb * B / L) - 2745 / 4 * (Cb * B / L) ** 2) * (-1927 / 500 + 2733 * TH / 200 - 2617 * (TH ** 2) / 250));
    const cgr2 = 1 + (-541 / 4 + 2432.95 * (Cb * B / L) - 10137.7 * (Cb * B / L) ** 2) * (TH ** 4.81);
    
    if (TH <= (-0.332 * T / B + 0.581)) {
      v.gamma_R_minus *= cgr2;
      v.gamma_R_plus *= cgr2;
    } else {
      v.gamma_R_minus *= cgr1;
      v.gamma_R_plus *= cgr1;
    }

    return v;
  }

  _cXWind(g_w, cx = 0.9) { return -cx * Math.cos(g_w); }
  _cYWind(g_w, cy = 0.95) { return cy * Math.sin(g_w); }
  _cNWind(g_w, cn = 0.2) { return cn * Math.sin(2 * g_w); }

  _cRB(m, x_G, r) {
    return mat3.fromValues(
      0, m * r, m * x_G * r,
      -m * r, 0, 0,
      -m * x_G * r, 0, 0
    );
  }

  _cA(m_x, m_y, u, vm) {
    return mat3.fromValues(
      0, 0, 0,
      0, 0, 0,
      -m_y * vm, m_x * u, 0
    );
  }

  nps_from_u(u) {
    let nps = 2.0;
    for (let i = 0; i < 100; i++) {
      const f = this.dynamics({ X: [u, 0, 0], psi: 0, delta: 0, nps, h: null })[0];
      const df = (this.dynamics({ X: [u, 0, 0], psi: 0, delta: 0, nps: nps + 0.01, h: null })[0] - f) / 0.01;
      const nps_new = nps - f / df;
      if (Math.abs(nps_new - nps) < 1e-6) return nps_new;
      nps = nps_new;
    }
    return nps;
  }

  step({ X, dT, nps, delta, psi, water_depth, fl_psi, fl_vel, w_vel, beta_w }) {
    if (fl_vel !== undefined && fl_vel !== null && fl_psi === undefined) {
      throw new Error('LogicError: No current direction specified.');
    }
    if (water_depth !== undefined && water_depth !== null && water_depth < this.vessel.d) {
      throw new Error(`LogicError: Water depth cannot be less than ship draft.`);
    }

    const uvr_dot = this.dynamics({ X, psi, delta, h: water_depth, nps, fl_psi, fl_vel, w_vel, beta_w });
    return uvr_dot.map(d => d * dT);
  }

  pstep({ X, pos, dT, nps, delta, psi, water_depth, fl_psi, fl_vel, w_vel, beta_w }) {
    const old_uvr = [...X];
    const rot = rotpsi(psi);
    const rotFlat = mat3.fromValues(
        rot[0][0], rot[1][0], rot[2][0],
        rot[0][1], rot[1][1], rot[1][1], // Wait, rot indices [row][col]
        rot[0][2], rot[1][2], rot[1][2]
    );
    // Correct way to flatten a row-major nested array for gl-matrix (col-major)
    const m = mat3.fromValues(
        rot[0][0], rot[1][0], rot[2][0], // col 0
        rot[0][1], rot[1][1], rot[2][1], // col 1
        rot[0][2], rot[1][2], rot[2][2]  // col 2
    );

    const old_eta_dot = vec3.create();
    vec3.transformMat3(old_eta_dot, vec3.fromValues(...old_uvr), m);

    const uvr_dot = this.step({ X, dT, nps, delta, psi, water_depth, fl_psi, fl_vel, w_vel, beta_w });
    const new_uvr = old_uvr.map((v, i) => v + uvr_dot[i]);

    const new_eta_dot = vec3.create();
    vec3.transformMat3(new_eta_dot, vec3.fromValues(...new_uvr), m);

    const avg_eta_dot = vec3.create();
    vec3.add(avg_eta_dot, old_eta_dot, new_eta_dot);
    vec3.scale(avg_eta_dot, avg_eta_dot, 0.5);

    const eta = [...pos, psi];
    const new_eta = eta.map((v, i) => v + avg_eta_dot[i] * dT);
    new_eta[2] = angle_to_two_pi(new_eta[2]);

    return [new_uvr, new_eta];
  }
}
