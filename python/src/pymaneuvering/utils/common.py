from dataclasses import dataclass
from enum import Enum
from typing import Optional
import numpy as np
import numpy.typing as npt
from abc import ABC, abstractmethod

class LogicError(Exception):
    pass

# Vessel fixed coordinate system type aliases
Surge = float  # Longitudinal velocity
Sway = float  # Lateral velocity
YawRate = float  # Yaw rate

Nu = tuple[Surge, Sway, YawRate]

# Earth fixed coordinate system type aliases
Northing = float  # North coordinate
Easting = float  # East coordinate
Psi = float  # Heading angle [rad]

EarthFixedPos = tuple[Northing, Easting]
Eta = tuple[Northing, Easting, Psi]

def angle_to_two_pi(angle: float) -> float:
    """Converts an angle to the range [0, 2*pi]."""
    return angle % (2 * np.pi)

def rotpsi(psi: float, offset: float = 0.0) -> np.ndarray:
    """Computes a rotation matrix for given heading (in rad)."""
    psi += offset
    return np.array(
        [
            [np.cos(psi), -np.sin(psi), 0.0],
            [np.sin(psi), np.cos(psi), 0.0],
            [0.0, 0.0, 1.0],
        ]
    )


@dataclass
class MMGVessel:
    
    rho: float # Water density
    rho_air: float # Air density
    
    # Vessel particulars
    C_b: float # Block Coefficient
    Lpp: float # Length over pependiculars (m)/
    B: float # Overall width
    d: float # Ship draft (Tiefgang)
    w_P0: float # Wake fraction coefficient
    x_G: float # X-Coordinate of the center of gravity (m)
    x_P: float # X-Coordinate of the propeller (-0.5*Lpp)
    D_p: float # Diameter of propeller (m)
    l_R: float # correction of flow straightening factor to yaw-rate
    eta: float # Ratio of propeller diameter to rudder span
    kappa: float # An experimental constant for expressing "u_R"
    A_R: float # Moveable rudder area
    epsilon: float # Ratio of wake fraction at propeller and rudder positions ((1 - w_R) / (1 - w_P))
    t_R: float # Steering resistance deduction factor
    t_P: float # Thrust deduction factor
    x_H_dash: float # Longitudinal coordinate of acting point of the additional lateral force
    a_H: float # Rudder force increase factor

    # Experimental wind projected areas+
    A_Fw: float # Frontal projected area of the wind
    A_Lw: float # Lateral projected area of the wind
    
    # MMG hydrodynamic derivatives
    R_0_dash: float # frictional resistance coefficient
    
    # Hull derivatives for longitudinal forces
    X_vv_dash: float # Hull derivatives
    X_vr_dash: float # Hull derivatives
    X_rr_dash: float # Hull derivatives
    X_vvvv_dash: float # Hull derivatives
    
    # Hull derivatives for lateral forces
    Y_v_dash: float # Hull derivatives
    Y_r_dash: float # Hull derivatives
    Y_vvv_dash: float # Hull derivatives
    Y_vvr_dash: float # Hull derivatives
    Y_vrr_dash: float # Hull derivatives
    Y_rrr_dash: float # Hull derivatives
    
    # Hull derivatives for yaw moment
    N_v_dash: float # Hull derivatives
    N_r_dash: float # Hull derivatives
    N_vvv_dash: float # Hull derivatives
    N_vvr_dash: float # Hull derivatives
    N_vrr_dash: float # Hull derivatives
    N_rrr_dash: float # Hull derivatives
    
    # Masses and added masses
    displ: float # Displacement in [m³]
    m_x_dash: float # Non dimensionalized added masses coefficient in x direction
    m_y_dash: float # Non dimensionalized added masses coefficient in y direction
    
    # Moment of inertia and added moment of inertia
    J_z_dash: float # Added moment of inertia coefficient
    
    # Wake change coefficients and propeller advance ratio polynomial
    k_0: float
    k_1: float
    k_2: float
    C_1: float
    C_2_plus: float
    C_2_minus: float
    J_slo: float
    J_int: float
    
    gamma_R_plus: float # Flow straightening coefficient for positive rudder angles
    gamma_R_minus: float # Flow straightening coefficient for negative rudder angles
    f_alpha: float # Rudder lift gradient coefficient

    gamma_R: Optional[float] = None # Flow straightening coefficient
    A_R_Ld_em: Optional[float] = None # Fraction of moveable Rudder area to length*draft
    delta_prop: Optional[float] = None

@dataclass
class AbkowitzVessel:

    # Reference Speed
    U_0: float

    # Properties
    L: float
    B: float
    T: float
    x_G: float # Longitudinal center of gravity from midship (m)
    m: float # Vessel mass (kg)
    r_zz: float # Radius of gyration in yaw (m)
    rho: float # Water density (kg/m³)
    
    # --- Surge Force (X) Coefficients ---
    X_0: float
    X_udot: float
    X_u: float
    X_uu: float
    X_vv: float
    X_vvvv: float # Term changes with water depth by multiplication with a polynomial
    X_rr: float
    X_vr: float
    X_vvrr: float
    X_dd: float
    X_udd: float

    # --- Sway Force (Y) Coefficients ---
    Y_0: float
    Y_vdot: float
    Y_rdot: float
    Y_v: float
    Y_vvv: float
    Y_r: float
    Y_rrr: float
    Y_vrr: float
    Y_vvr: float
    Y_d: float
    Y_ddd: float
    Y_ud: float
    Y_uddd: float

    # --- Yaw Moment (N) Coefficients ---
    N_0: float
    N_vdot: float
    N_rdot: float
    N_v: float
    N_vvv: float
    N_r: float
    N_rrr: float
    N_vrr: float
    N_vvr: float
    N_d: float
    N_ddd: float
    N_ud: float
    N_uddd: float

@dataclass
class MinimalVessel:
        
    # Vessel particulars
    m: float # Displacent of ship
    C_b: float # Block Coefficient
    Lpp: float # Length over pependiculars (m)/
    B: float # Overall width
    d: float # Ship draft (Tiefgang)
    eta: float # Ratio of propeller diameter to rudder span
    A_R: float # Rudder Area
    D_p: float # Propeller diameter
    f_alpha: Optional[float] = None # Rudder lift gradient coefficient
    x_G: Optional[float] = None # X-Coordinate of the center of gravity (m)
    w_P0: Optional[float] = None # Wake fraction coefficient
    t_P: Optional[float] = None # Thrust deduction factor

class Maneuvervable(ABC):
    """Abstract Base Class for maneuverable vessels."""
    @abstractmethod
    def dynamics(self, *args, **kwargs) -> npt.NDArray[np.float32]:
        """Dynamics function for maneuverable vessels, solving for u_dot, v_dot and r_dot."""
        pass
    
    def step(self, *args, **kwargs) -> npt.NDArray[np.float32]:
        """Perform a single time step using Euler integration."""
        pass

    def pstep(self, *args, **kwargs) -> tuple[npt.NDArray[np.float32], npt.NDArray[np.float32]]:
        """Perform a single time step and transform to earth-fixed coordinates."""
        pass
    
class IntegrationMode(Enum):
    """Enumeration for integration modes."""
    TRAPEZOIDAL = 1
    RK4 = 2


Surge        = float
Sway         = float
YawRate      = float
RudderAngle  = float
RevPerSecond = float

@dataclass
class InitialValues:
    u: Surge
    v: Sway
    r: YawRate
    delta: RudderAngle
    nps: RevPerSecond