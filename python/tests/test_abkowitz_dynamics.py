import numpy as np
import pytest
from pymaneuvering import Vessel, VTYPE, IntegrationMode

def test_abkowitz_gms_like_dynamics():
    """
    Test Abkowitz dynamics (u_dot, v_dot, r_dot) for GMS_LIKE.
    """
    vessel = Vessel(new_from=VTYPE.GMS_LIKE)
    
    # Inputs
    X = np.array([2.0, 0.1, 0.05])
    psi = 0.0
    delta = 0.17453292519943295  # 10 degrees in radians
    h = 15.0
    
    # Expected output (captured from ground truth)
    expected_dot = np.array([
        0.015231531436260673,
        -0.02412783530822922,
        -0.008898846872757054
    ])
    
    # Actual output
    actual_dot = vessel.dynamics(
        X=X, psi=psi, delta=delta, h=h, 
        fl_psi=None, fl_vel=None
    )
    
    np.testing.assert_allclose(actual_dot, expected_dot, rtol=1e-5)

def test_abkowitz_gms_like_pstep_trapezoidal():
    """
    Test Abkowitz pstep in TRAPEZOIDAL mode for GMS_LIKE.
    """
    vessel = Vessel(new_from=VTYPE.GMS_LIKE)
    
    X = np.array([2.0, 0.1, 0.05])
    pos = [0.0, 0.0]
    psi = 0.0
    delta = 0.17453292519943295
    h = 15.0
    dT = 1.0
    
    expected_uvr = np.array([
        2.0152316093444824,
        0.07587216794490814,
        0.04110115393996239
    ])
    expected_eta = np.array([
        2.004843235015869,
        -0.13377834856510162,
        0.04555057734251022
    ])
    
    actual_uvr, actual_eta = vessel.pstep(
        X=X, pos=pos, dT=dT, delta=delta, psi=psi, water_depth=h, 
        mode=IntegrationMode.TRAPEZOIDAL
    )
    
    np.testing.assert_allclose(actual_uvr, expected_uvr, rtol=1e-5)
    np.testing.assert_allclose(actual_eta, expected_eta, rtol=1e-5)

def test_abkowitz_gms_like_pstep_rk4():
    """
    Test Abkowitz pstep in RK4 mode for GMS_LIKE.
    """
    vessel = Vessel(new_from=VTYPE.GMS_LIKE)
    
    X = np.array([2.0, 0.1, 0.05])
    pos = [0.0, 0.0]
    psi = 0.0
    delta = 0.17453292519943295
    h = 15.0
    dT = 1.0
    
    expected_uvr = np.array([
        2.0137170553207397,
        0.07512024082243443,
        0.042692707106471064
    ])
    expected_eta = np.array([
        2.0043768882751465,
        -0.1351604163646698,
        0.04610488563776016
    ])
    
    actual_uvr, actual_eta = vessel.pstep(
        X=X, pos=pos, dT=dT, delta=delta, psi=psi, water_depth=h, 
        mode=IntegrationMode.RK4
    )
    
    np.testing.assert_allclose(actual_uvr, expected_uvr, rtol=1e-5)
    np.testing.assert_allclose(actual_eta, expected_eta, rtol=1e-5)

def test_abkowitz_scenarios_dynamics():
    """
    Test Abkowitz dynamics with current.
    """
    vessel = Vessel(new_from=VTYPE.GMS_LIKE)
    X = np.array([2.0, 0.1, 0.05])
    psi = 0.0
    delta = 0.17453292519943295
    h = 15.0
    fl_vel = 0.5
    fl_psi = 0.7853981633974483 # pi/4
    
    expected_current = np.array([0.041504697207875155, -0.0590320284931979, -0.010299852306726255])
    actual_current = vessel.dynamics(X=X, psi=psi, delta=delta, h=h, fl_psi=fl_psi, fl_vel=fl_vel)
    
    np.testing.assert_allclose(actual_current, expected_current, rtol=1e-5)

def test_abkowitz_errors():
    vessel = Vessel(new_from=VTYPE.GMS_LIKE)
    # fl_vel set but fl_psi missing
    with pytest.raises(Exception):
        vessel.step(X=np.array([1,0,0]), delta=0, psi=0, water_depth=15, fl_vel=0.5)
    
    # water_depth < draft
    with pytest.raises(Exception):
        vessel.step(X=np.array([1,0,0]), delta=0, psi=0, water_depth=1.0)
        
    # Unknown integration mode
    with pytest.raises(ValueError):
        vessel.pstep(X=np.array([1,0,0]), pos=[0,0], dT=1, delta=0, psi=0, water_depth=15, mode="INVALID")
