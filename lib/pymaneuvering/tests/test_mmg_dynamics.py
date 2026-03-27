import numpy as np
import pytest
from pymaneuvering import Vessel, VTYPE

def test_mmg_kvlcc2_l64_dynamics():
    """
    Test MMG dynamics (u_dot, v_dot, r_dot) for KVLCC2_L64.
    """
    vessel = Vessel(new_from=VTYPE.KVLCC2_L64)
    
    # Inputs
    X = np.array([2.0, 0.1, 0.05])
    psi = 0.0
    delta = 0.17453292519943295  # 10 degrees in radians
    nps = 5
    h = 15.0
    
    # Expected output (captured from ground truth)
    expected_dot = np.array([
        0.039775520268798305,
        -0.03944280895063721,
        -0.005357673550581492
    ])
    
    # Actual output
    actual_dot = vessel.dynamics(
        X=X, psi=psi, delta=delta, h=h, nps=nps,
        fl_psi=None, fl_vel=None, w_vel=None, beta_w=None
    )
    
    np.testing.assert_allclose(actual_dot, expected_dot, rtol=1e-5)

def test_mmg_kvlcc2_l64_step():
    """
    Test MMG step for KVLCC2_L64.
    """
    vessel = Vessel(new_from=VTYPE.KVLCC2_L64)
    
    X = np.array([2.0, 0.1, 0.05])
    delta = 0.17453292519943295
    nps = 5
    h = 15.0
    dT = 1.0
    psi = 0.0
    
    expected_step_dot = np.array([
        0.039775520268798305,
        -0.03944280895063721,
        -0.005357673550581492
    ])
    
    actual_step_dot = vessel.step(
        X=X, dT=dT, nps=nps, delta=delta, psi=psi, water_depth=h
    )
    
    np.testing.assert_allclose(actual_step_dot, expected_step_dot, rtol=1e-5)

def test_mmg_kvlcc2_l64_pstep():
    """
    Test MMG pstep for KVLCC2_L64.
    """
    vessel = Vessel(new_from=VTYPE.KVLCC2_L64)
    
    X = np.array([2.0, 0.1, 0.05])
    pos = [0.0, 0.0]
    psi = 0.0
    delta = 0.17453292519943295
    nps = 5
    h = 15.0
    dT = 1.0
    
    # Expected outputs (captured)
    expected_uvr = np.array([
        2.0397755202687984,
        0.060557191049362795,
        0.04464232644941851
    ])
    expected_eta = np.array([
        2.019887760134399,
        0.0802785955246814,
        0.04732116322470926
    ])
    
    actual_uvr, actual_eta = vessel.pstep(
        X=X, pos=pos, dT=dT, nps=nps, delta=delta, psi=psi, water_depth=h
    )
    
    np.testing.assert_allclose(actual_uvr, expected_uvr, rtol=1e-5)
    np.testing.assert_allclose(actual_eta, expected_eta, rtol=1e-5)

def test_mmg_scenarios_dynamics():
    """
    Test MMG dynamics with environmental factors and shallow water.
    """
    vessel = Vessel(new_from=VTYPE.KVLCC2_L64)
    X = np.array([2.0, 0.1, 0.05])
    psi = 0.0
    delta = 0.17453292519943295
    nps = 5
    h_deep = 15.0
    h_shallow = vessel.vessel.d * 1.2
    
    # Current
    fl_vel = 0.5
    fl_psi = 0.7853981633974483 # pi/4
    expected_current = np.array([0.04904502176452721, -0.06434092417272745, -0.006501525670116164])
    actual_current = vessel.dynamics(X=X, psi=psi, delta=delta, h=h_deep, nps=nps, fl_psi=fl_psi, fl_vel=fl_vel, w_vel=None, beta_w=None)
    np.testing.assert_allclose(actual_current, expected_current, rtol=1e-5)

    # Wind
    w_vel = 10.0
    beta_w = 1.5707963267948966 # pi/2
    expected_wind = np.array([0.03878138767695626, -0.030134120694622683, -0.005192338629460642])
    actual_wind = vessel.dynamics(X=X, psi=psi, delta=delta, h=h_deep, nps=nps, fl_psi=None, fl_vel=None, w_vel=w_vel, beta_w=beta_w)
    np.testing.assert_allclose(actual_wind, expected_wind, rtol=1e-5)

    # Shallow Water
    expected_shallow = np.array([0.053066135267069554, -0.030421497449696938, -0.011946923486595259])
    actual_shallow = vessel.dynamics(X=X, psi=psi, delta=delta, h=h_shallow, nps=nps, fl_psi=None, fl_vel=None, w_vel=None, beta_w=None)
    np.testing.assert_allclose(actual_shallow, expected_shallow, rtol=1e-5)

    # Zero Velocity
    X_zero = np.array([0.0, 0.0, 0.0])
    expected_zero = np.array([0.03239151331207554, 0.0, 0.0])
    actual_zero = vessel.dynamics(X=X_zero, psi=psi, delta=delta, h=h_deep, nps=nps, fl_psi=None, fl_vel=None, w_vel=None, beta_w=None)
    np.testing.assert_allclose(actual_zero, expected_zero, rtol=1e-5)

def test_mmg_nps_from_u():
    vessel = Vessel(new_from=VTYPE.KVLCC2_L64)
    expected_nps = 2.426211674340134
    actual_nps = vessel.nps_from_u(u=2.0)
    assert actual_nps == pytest.approx(expected_nps, rel=1e-5)
    
def test_mmg_errors():
    vessel = Vessel(new_from=VTYPE.KVLCC2_L64)
    # fl_vel set but fl_psi missing
    with pytest.raises(Exception): # LogicError
        vessel.step(X=np.array([1,0,0]), dT=1, nps=5, delta=0, psi=0, fl_vel=0.5)
    
    # water_depth < draft
    with pytest.raises(Exception):
        vessel.step(X=np.array([1,0,0]), dT=1, nps=5, delta=0, psi=0, water_depth=2.0)
