from __future__ import annotations

from warnings import warn
import math
from typing import Optional
from copy import copy
import numpy as np
from numpy import typing as npt
from scipy.optimize import fsolve

from ..utils import common as cmn

"""
Set up the System of ODEs for vessel maneuvering prediction after 
Yasukawa, H., Yoshimura, Y. (2015) Introduction of MMG standard method for ship maneuvering predictions.
J Mar Sci Technol 20, 37-52 https://doi.org/10.1007/s00773-014-0293-y


On each step, the longitudinal, lateral and yaw-rate accelerations are calculated
from a set of initial conditions X for an arbitrary time horizon. 
"""

# Export only selected functions if used as wildcard import
__all__ = ["calibrate"]

# System of ODEs after Yasukawa, H., Yoshimura, Y. (2015)

class MMGModel(cmn.Maneuvervable):
    """MMG standard model dynamics class.

    Attributes:
        vessel (MMGVessel):
            Vessel parameters according to the MMG standard model.

    """
    def __init__(self, vessel: cmn.MMGVessel):
        self.vessel = vessel
    
    def dynamics(
        self, *,
        X: np.ndarray, 
        psi:float,
        delta: float, 
        h: float | None,
        nps: float, 
        fl_psi: float | None, 
        fl_vel: float | None, 
        w_vel:float | None, 
        beta_w: float | None) -> npt.NDArray[np.float32]:
        """
        System of ODEs after Yasukawa, H., Yoshimura, Y. (2015)
        for the MMG standard model

        Args:
            X (np.ndarray): 
                Initial values (u, v, r) at current timestep
            psi (float): 
                Vessel heading in the global frame
            delta (float): 
                Rudder angle [rad]
            h (float):
            nps (float): 
                Propeller revolutions per second [1/s]
            fl_psi (float): 
                Attack angle of current relative
                longitudinal axis of motion [rad]
            fl_vel (float): 
                Velocity of current [m/s]
            w_vel (float):
                Wind speed [m/s]
            beta_w (float):
                Wind attack angle relative to vessel heading [rad]

        Returns:
            np.ndarray: Derivatives of the ODE for the current timestep (mostly for solver)
        """

        # Shorten the parameter dict to avoid clutter
        p = self.vessel

        # Correct for shallow water if needed
        if h is not None:
            p = self._shallow_water_hdm(h)

        # Unpack state vector (surge, sway, yaw rate)
        u, v_m, r  = X
        
        if fl_vel is not None and fl_psi is not None:
            u_c = fl_vel * math.cos(fl_psi - psi - math.pi)
            v_c = fl_vel * math.sin(fl_psi - psi - math.pi)
            
            # Relative velocities
            u_r = u - u_c
            v_r = v_m - v_c

            # Hydrodynamic forces with relative velocities
            u_pure = u
            vm_pure = v_m
            u = u_r
            v_m = v_r

        U = math.sqrt(u**2 + v_m**2)  # Overall speed of the vessel

        if U == 0.0:  # No vessel movement. Velocity in all directions = 0
            beta = 0.0
            v_dash = 0.0
            r_dash = 0.0
        else:
            beta = math.atan(-v_m/u)  # Drift angle at midship position
            v_dash = v_m / U  # Non-dimensionalized lateral velocity
            r_dash = r * p.Lpp / U  # Non-dimensionalized yaw rate

        # Redefine
        beta_P = beta - (p.x_P/p.Lpp) * r_dash
        if all(getattr(p,k) is not None for k in ("C_1","C_2_plus","C_2_minus")):
            C_2 = p.C_2_plus if beta_P >= 0 else p.C_2_minus
            tmp = 1-math.exp(-p.C_1*abs(beta_P))*(C_2-1)
            w_P = 1-(1-p.w_P0)*(1+tmp)
        else:
            w_P = p.w_P0 * math.exp(-4.0 * beta_P**2)

        if nps == 0.0:  # No propeller movement, no advance ratio
            J = 0.0
        else:
            J = (1 - w_P) * u / (nps * p.D_p)  # Propeller advance ratio

        if all(getattr(p,k) is not None for k in ("k_0", "k_1", "k_2")):
            # Propeller thrust open water characteristic
            K_T = p.k_0 + (p.k_1 * J) + (p.k_2 * J**2)
        else:
            # Inferred slope + intercept dependent on J (empirical)
            K_T = p.J_slo * J + p.J_int

        # Effective inflow angle to rudder in maneuvering motions
        beta_R = beta - p.l_R * r_dash

        # Flow straightening coefficient
        if p.gamma_R is not None:
            gamma_R = p.gamma_R
        else:
            if beta_R < 0.0:
                gamma_R = p.gamma_R_minus
            else:
                gamma_R = p.gamma_R_plus

        # Lateral inflow velocity components to rudder
        v_R = U * gamma_R * beta_R

        # Longitudinal inflow velocity components to rudder
        if J == 0.0:
            u_R = 0.0
        else:
            u_R = u * (1 - w_P) * p.epsilon * math.sqrt(
                p.eta * (1.0 + p.kappa * (
                    math.sqrt(1.0 + 8.0 * K_T / (math.pi * J**2)) - 1))**2 + (1 - p.eta)
            )
        # Rudder inflow velocity
        U_R = math.sqrt(u_R**2 + v_R**2)

        # Rudder inflow angle
        if p.delta_prop is not None:
            alpha_R = delta - p.delta_prop - v_R/u_R
        else:
            alpha_R = delta - math.atan2(v_R, u_R)

        # Normal force on rudder
        if p.A_R is not None:
            F_N = 0.5 * p.A_R * p.rho * \
                p.f_alpha * (U_R**2) * math.sin(alpha_R)
        else:
            F_N = 0.5 * p.A_R_Ld_em * (p.Lpp * p.d * p.rho) * \
                p.f_alpha * (U_R**2) * math.sin(alpha_R)

        # Longitudinal surge force around midship acting on ship hull
        X_H = (0.5 * p.rho * p.Lpp * p.d * (U**2) * (
            - p.R_0_dash
            + p.X_vv_dash * (v_dash**2)
            + p.X_vr_dash * v_dash * r_dash
            + p.X_rr_dash * (r_dash**2)
            + p.X_vvvv_dash * (v_dash**4)
        )
        )

        # Longitudinal surge force around midship by steering
        X_R = -(1 - p.t_R) * F_N * math.sin(delta)

        # Longitudinal Surge force due to propeller
        X_P = (1 - p.t_P) * p.rho * K_T * nps**2 * p.D_p**4

        # Longitudinal surge force around midship acting on ship hull
        Y_H = (0.5 * p.rho * p.Lpp * p.d * (U**2) * (
            p.Y_v_dash * v_dash
            + p.Y_r_dash * r_dash
            + p.Y_vvv_dash * (v_dash**3)
            + p.Y_vvr_dash * (v_dash**2) * r_dash
            + p.Y_vrr_dash * v_dash * (r_dash**2)
            + p.Y_rrr_dash * (r_dash**3)
        )
        )

        # Lateral surge force by steering
        Y_R = -(1 + p.a_H) * F_N * math.cos(delta)

        # Yaw moment around midship acting on ship hull
        N_H = (0.5 * p.rho * (p.Lpp**2) * p.d * (U**2) * (
            p.N_v_dash * v_dash
            + p.N_r_dash * r_dash
            + p.N_vvv_dash * (v_dash**3)
            + p.N_vvr_dash * (v_dash**2) * r_dash
            + p.N_vrr_dash * v_dash * (r_dash**2)
            + p.N_rrr_dash * (r_dash**3)
        )
        )

        # Redimensionalize x_H
        x_H = p.x_H_dash * p.Lpp

        # yaw moment around midship by steering
        N_R = -(-0.5*p.Lpp + p.a_H * x_H) * F_N * math.cos(delta)

            #-------------------------------- Wind ---------------------------------
        if w_vel != 0.0 and w_vel is not None and beta_w is not None:
            
            # relative velocity computations
            u_w = w_vel * math.cos(beta_w - psi)
            v_w = w_vel * math.sin(beta_w - psi)

            u_rw = u - u_w
            v_rw = v_m - v_w

            V_rw_sq = u_rw**2 + v_rw**2
            g_rw = -math.atan2(v_rw, u_rw)

            # forces               
            X_W = 1/2 * p.rho_air * V_rw_sq * self._C_X_wind(g_rw) * p.A_Fw
            Y_W = 1/2 * p.rho_air * V_rw_sq * self._C_Y_wind(g_rw) * p.A_Lw
            N_W = 1/2 * p.rho_air * V_rw_sq * self._C_N_wind(g_rw) * p.A_Lw * p.Lpp

        else:
            X_W, Y_W, N_W = 0.0, 0.0, 0.0


        # Added masses and added moment of inertia
        m_x = p.m_x_dash * (0.5 * p.rho * (p.Lpp**2) * p.d)
        m_y = p.m_y_dash * (0.5 * p.rho * (p.Lpp**2) * p.d)
        J_z = p.J_z_dash * (0.5 * p.rho * (p.Lpp**4) * p.d)
        m = p.displ*p.rho
        I_zG = m*(0.25*p.Lpp)**2
        
        # Mass matrices
        M_RB = np.array([[m, 0.0, 0.0],
                        [0.0, m, m * p.x_G],
                        [0.0, m * p.x_G, I_zG]])
        M_A = np.array([[m_x, 0.0, 0.0],
                        [0.0, m_y, 0.0],
                        [0.0, 0.0, J_z + (p.x_G**2) * m]])
        M_inv = np.linalg.inv(M_RB + M_A)

        FX = X_H + X_R + X_P + X_W
        FY = Y_H + Y_R + Y_W
        FN = N_H + N_R + N_W
        
        F = np.array([FX,FY,FN])
        
        if fl_vel is not None and fl_psi is not None:
            nu_c_dot = np.array([v_c*r, -u_c*r, 0.0])
            return np.dot(
                M_inv, 
                F - np.dot(
                    self._C_RB(m=m,x_G=p.x_G,r=r), 
                    np.array([u_pure, vm_pure, r]))
                - np.dot(
                    self._C_A(vm=v_m,u=u,m_x=m_x,m_y=m_y), 
                    np.array([u_r, v_r, r])  
                + np.dot(M_A, nu_c_dot))
            )
        else:
            return np.dot(
                M_inv, 
                F - np.dot(
                    (
                        self._C_RB(m=m,x_G=p.x_G,r=r) + 
                        self._C_A(vm=v_m,u=u,m_x=m_x,m_y=m_y)
                    ), 
                    np.array([u, v_m, r]))
                )

    def _shallow_water_hdm(self, water_depth: float) -> cmn.MMGVessel:
        """Correct the hydrodynamic derivatives and
        hydrodynamic masses for shallow water conditions.

        Sources:
            Taimuri et. al. (2020) https://doi.org/10.1016/j.oceaneng.2020.108103


        Args:
            v (dict): vessel parameter dict
            water_depth (float): water depth around vessel [m]
        """
        def frac(x: float, y: float) -> float: return x/y
        v = copy(self.vessel)

        # Length, Beam (width), Draft, Block Coefficient
        L, B, T, Cb = v.Lpp, v.B, v.d, v.C_b

        H = water_depth

        HT = H/T -1
        TH = T/H
        K0 = 1+frac(0.0775,HT**2)-frac(0.011,HT**3)+frac(0.000068,HT**5)
        K1 = -frac(0.0643,HT)+frac(0.0724,HT**2)-frac(0.0113,HT**3)+frac(0.0000767,HT**5)
        K2 = frac(0.0342,HT) if B/T <= 4 else frac(0.137*B,HT*T)
        B1 = Cb*B*(1+frac(B,L))**2
        B2 = 0.83*frac(B1,Cb)

        A1Yr   = -5.5*(frac(Cb*B,T))**2+26*frac(Cb*B,T)-31.5
        A1Yrr  = -15600*(1-Cb)**5
        A1Yvrr = 21500*(((1-Cb)*frac(T,B))**2)-4800*((1-Cb)*frac(T,B))+220
        A1Nvv  = -240*(1-Cb)+57
        A1Nrr  = -1960*((1-Cb)*frac(T,B))**2+448*(1-Cb)*frac(T,B)-25
        A1Nvvr = 91*Cb*frac(T,B)-25
        A1Nvrr = 40*Cb*frac(B,T)-88
        A2Yr   = 37*frac(Cb*B,T)**2-185*frac(Cb*B,T)+230
        A2Yrr  = 116000*(1-Cb)**5
        A2Yvrr = -40800*((1-Cb)*frac(T,B))**2+7500*(1-Cb)*frac(T,B)-274
        A2Nvv  = 1770*(1-Cb)-413
        A2Nrr  = 12220*((1-Cb)*frac(T,B))**2-2720*(1-Cb)*frac(T,B)+146
        A2Nvvr = -515*Cb*frac(T,B)+144
        A2Nvrr = -295*Cb*frac(B,T)+645
        A3Yr   = -38*frac(Cb*B,T)**2+197*frac(Cb*B,T)-250
        A3Yrr  = -128000*(1-Cb)**5
        A3Yvvr = -90800*((1-Cb)*frac(T,B))**2+25500*(1-Cb)*frac(T,B)-1400
        A3Nvv  = -1980*(1-Cb)+467
        A3Nrr  = -12160*((1-Cb)*frac(T,B))**2+2650*(1-Cb)*frac(T,B)-137
        A3Nvvr = 508*Cb*frac(T,B)-143
        A3Nvrr = 312*Cb*frac(B,T)-678

        gv = K0+frac(2,3)*K1*frac(B1,T)+frac(8,15)*K2*(frac(B1,T))**2
        gnr = K0+frac(8,15)*K1*frac(B1,T)+frac(40,105)*K2*(frac(B1,T))**2
        fyr = K0+frac(2,5)*K1*frac(B1,T)+frac(24,105)*K2*(frac(B1,T))**2
        fnr = K0+frac(1,2)*K1*frac(B1,T)+frac(1,3)*K2*(frac(B1,T))**2
        fyv = 1.5*fnr-0.5
        fnv = K0+K1*frac(B1,T)+K2*frac(B1,T)**2

        # Corrections 

        v.X_vv_dash *= fyv
        v.X_vvvv_dash *= fyv
        v.X_rr_dash *= fnr
        v.X_vr_dash *= fyr
        v.Y_vvv_dash *= fyv
        v.N_v_dash *= fnv
        v.N_vvv_dash *= fyv
        v.Y_rrr_dash *= gnr
        v.N_rrr_dash *= gnr
        v.Y_vvr_dash *= fyv
        v.Y_vrr_dash *= fyv

        v.Y_v_dash *= (-TH+frac(1,(1-TH)**(frac(0.4*Cb*B,T))))
        v.Y_r_dash *= (1+A1Yr*TH+A2Yr*TH**2+A3Yr*TH**3)
        v.N_r_dash *= (-TH+frac(1,(1-TH)**(frac(-14.28*T,L)+1.5)))

        v.N_vvr_dash *= (1+A1Nvvr*TH+A2Nvvr*TH**2+A3Nvvr*TH**3)
        v.N_vrr_dash *= (1+A1Nvrr*TH+A2Nvrr*TH**2+A3Nvrr*TH**3)

        # Corrections for wake fraction, thrust deduction,
        # and flow-straighening coefficients
        v.w_P0 *= (1+(-4.932+0.6425*frac(Cb*L,T)-0.0165*(frac(Cb*L,T)**2))*TH**1.655)
        ctp = 1+((29.495-14.089*frac(Cb*L,B)+1.6486*frac(Cb*L,B)**2)*(frac(1,250)-frac(7*TH,200)-frac(13*TH**2,125)))
        v.t_P = 1-ctp*(1-v.t_P)
        cgr1 = 1+((frac(-5129,500)+178.207*frac(Cb*B,L)-frac(2745,4)*frac(Cb*B,L)**2)*(frac(-1927,500)+frac(2733*TH,200)-frac(2617*TH**2,250)))
        cgr2 = 1+(frac(-541,4)+2432.95*frac(Cb*B,L)-10137.7*frac(Cb*B,L)**2)*TH**4.81
        if TH <= (-0.332*frac(T,B)+0.581):
            v.gamma_R_minus *= cgr2
            v.gamma_R_plus *= cgr2
        else:
            v.gamma_R_minus *= cgr1
            v.gamma_R_plus *= cgr1
            
        return v


    def _C_X_wind(self,g_w, cx=0.9):
        return -cx*math.cos(g_w)

    def _C_Y_wind(self, g_w, cy=0.95):
        return cy*math.sin(g_w)

    def _C_N_wind(self, g_w, cn=0.2):
        return cn*math.sin(2*g_w)    

    def _C_RB(self, *,m,x_G, r):
        return np.array(
            [[0.0, -m * r, -m * x_G * r],
            [m * r, 0.0, 0.0],
            [m * x_G * r, 0.0, 0.0]])

    def _C_A(self, *,m_x,m_y,u, vm):
        return np.array(
            [[0.0, 0.0, -m_y * vm],
            [0.0, 0.0, m_x * u],
            [0.0, 0.0, 0.0]])

    def nps_from_u(self, u: float) -> float:
        """
        Calculate the propeller revolutions per second given
        the surge velocity of the vessel.
        
        This is a helper function to estimate the propeller
        revolutions per second based on the surge velocity of
        the vessel. To ease the calculation, all 
        environmental factors are set to zero.
        """
        # Initial guess
        nps0 = 2.0
        
        # UVR proxy
        X = np.array([u, 0.0, 0.0])
        
        def to_root(nps):
            return self.dynamics(
                X=X,
                psi=0.0,
                delta=0.0,
                h=None,
                nps=nps[0],
                fl_psi=0.0,
                fl_vel=0.0,
                w_vel=0.0,
                beta_w=0.0
            )[0]  # Return only surge acceleration
        
        # Solve for nps
        return fsolve(to_root, nps0)[0]

    def step(
        self,*,
        X: np.ndarray,
        dT: float,
        nps: float,
        delta: float,
        psi: float,
        fl_psi: Optional[float] = None,
        fl_vel: Optional[float] = None,
        w_vel: Optional[float] = None,
        beta_w: Optional[float] = None,
        water_depth: Optional[float] = None,
    ) -> npt.NDArray[np.float32]:
        """Solve the MMG system for a given vessel for an arbitrarily long timestep

        Args:
            X (np.ndarray): Initial values: np.array([u,v,r])
            params (dict): Vessel dict
            nps (float): Propeller revolutions per second (not per minute!)
            delta (float): Rudder angle in [rad]
            fl_psi (float): Attack angle of current relative to heading [rad]
            fl_vel (Optional[float]): Fluid velocity (Current velocity)
            w_vel (Optional[float]): Wind velocity
            beta_w (Optional[float]): Wind attack angle
            water_depth( Optional[float]): Water depth if vessel is simulated in shallow water

        Raises:
            LogicError: - If the water depth is less than the
                        ships draft. Ship would run aground. It is recommended
                        to have at least (1.2*draft) meters of water under the vessel.
                        - If a current velocity has been set but no
                        attack angle for it.

        Returns:
            Derivatives of u,v and r in the vessel fixed coordinate system
        """

        if fl_vel is not None and fl_psi is None:
            raise cmn.LogicError(
                "No current direction specified. Use the `fl_psi` keyword to set it."
            )
        if fl_vel is None and fl_psi is not None:
            warn(
                "Current attack angle is given but current velocity is "
                "turned off. Attack angle is ignored."
            )

        # Correct for shallow water if a water depth is given.
        # If none is given, open water with infinite depth is assumed
        if water_depth is not None:
            if water_depth < self.vessel.d:
                raise cmn.LogicError(
                    "Water depth cannot be less than ship draft.\n"
                    f"Water depth: {np.round(water_depth, 3)} | Ship draft: {self.vessel.d}"
                )

        # Develop equation of motion
        uvr_dot = self.dynamics(
            X=X,
            nps=nps,
            delta=delta,
            h=water_depth,
            psi=psi,
            fl_psi=fl_psi,
            fl_vel=fl_vel,
            w_vel=w_vel,
            beta_w=beta_w,
        )

        # Just return the relevant derivatives
        return uvr_dot * dT


    def pstep(
        self,*,
        X: np.ndarray,
        pos: cmn.EarthFixedPos,
        dT: float,
        nps: float,
        delta: float,
        psi: float,
        fl_psi: Optional[float] = None,
        fl_vel: Optional[float] = None,
        w_vel: Optional[float] = None,
        beta_w: Optional[float] = None,
        water_depth: Optional[float] = None,
    ) -> tuple[npt.NDArray[np.float32], npt.NDArray[np.float32]]:
        """
        Same as step but, the transformation of the velocities to the
        earth fixed coordinate system is done here automatically.

        Returns:
            np.ndarray: New surge, sway and yaw rate of the vessel (Nu)
            np.ndarray: New position and heading of the vessel (Eta)
        """
        old_uvr = X.copy()
        old_eta_dot = np.dot(cmn.rotpsi(psi), old_uvr)

        uvr_dot = self.step(
            X=X,
            dT=dT,
            nps=nps,
            delta=delta,
            psi=psi,
            fl_psi=fl_psi,
            fl_vel=fl_vel,
            w_vel=w_vel,
            beta_w=beta_w,
            water_depth=water_depth,
        )

        # Get new velocities in the vessel fixed coordinate system
        new_uvr = old_uvr + uvr_dot

        # Find new eta_dot via rotation
        eta_dot_new = np.dot(cmn.rotpsi(psi), new_uvr)

        # Update position in earth fixed coordinate system
        eta = np.hstack((pos, psi))
        new_eta = eta + 0.5 * (old_eta_dot + eta_dot_new) * dT

        # Correct for overshooting heading angles
        new_eta[2] = cmn.angle_to_two_pi(new_eta[2])

        # (array[u,v,r], array[N,E,psi])
        return new_uvr, new_eta

def calibrate(v: cmn.MinimalVessel, rho: float) -> cmn.MMGVessel:
    """Calculate relevant hydrodynamic derivatives based on a minimal
    dict and a given water density

    Sources:
        Suras and Sakir Bal (2019)

    Args:
        v (MinimalVessel): Minimal vessel parameters
        rho (float): water density

    Raises:
        KeyError: If your dict is incomplete, calculations will be aborted

    Returns:
        dict: Dict with all relevant information to be used as input in the step() function
    """
    
    # Unpack initial dict
    L, B, d, Cb, m = v.Lpp, v.B, v.d, v.C_b, v.m

    # X-Coordinate of the center of gravity (m)
    if v.x_G is None:
        v.x_G = float(0)

    # X-Coordinate of the propeller (assumed as -0.5*Lpp)
    v.x_P = -0.5*L

    # Add current water density to dict
    v.rho = rho

    # Masses and Moment of Inertia
    nondim_M = 0.5 * v.rho * L**2 * d
    nondim_N = 0.5 * v.rho * L**4 * d
    # Displacement mapping
    v.displ = m

    # Default values for missing fields required by MMGVessel
    if getattr(v, "rho_air", None) is None: v.rho_air = 1.225
    if getattr(v, "A_Fw", None) is None: v.A_Fw = 0.0
    if getattr(v, "A_Lw", None) is None: v.A_Lw = 0.0
    if getattr(v, "C_1", None) is None: v.C_1 = 2.0
    if getattr(v, "C_2_plus", None) is None: v.C_2_plus = 1.6
    if getattr(v, "C_2_minus", None) is None: v.C_2_minus = 1.1
    if getattr(v, "delta_prop", None) is None: v.delta_prop = 0.0

    # Ensure all required fields exist in v (even if as None or 0)
    # This is a bit of a hack to satisfy the dataclass if they are missing
    required_fields = [
        "rho", "rho_air", "C_b", "Lpp", "B", "d", "w_P0", "x_G", "x_P", "D_p",
        "l_R", "eta", "kappa", "A_R", "epsilon", "t_R", "t_P", "x_H_dash", "a_H",
        "A_Fw", "A_Lw", "R_0_dash", "X_vv_dash", "X_vr_dash", "X_rr_dash",
        "X_vvvv_dash", "Y_v_dash", "Y_r_dash", "Y_vvv_dash", "Y_vvr_dash",
        "Y_vrr_dash", "Y_rrr_dash", "N_v_dash", "N_r_dash", "N_vvv_dash",
        "N_vvr_dash", "N_vrr_dash", "N_rrr_dash", "displ", "m_x_dash",
        "m_y_dash", "J_z_dash", "k_0", "k_1", "k_2", "C_1", "C_2_plus",
        "C_2_minus", "J_slo", "J_int", "gamma_R_plus", "gamma_R_minus", "f_alpha"
    ]
    for field in required_fields:
        if not hasattr(v, field):
            setattr(v, field, 0.0)

    # Clean up fields that are not in MMGVessel but might be in MinimalVessel (like 'm')
    data = {k: v for k, v in v.__dict__.items() if k in required_fields or k in ["gamma_R", "A_R_Ld_em", "delta_prop"]}
    
    return cmn.MMGVessel(**data)

