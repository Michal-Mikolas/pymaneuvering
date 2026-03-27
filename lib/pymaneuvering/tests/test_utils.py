import numpy as np
import pytest
import math
from pymaneuvering.utils.common import rotpsi, angle_to_two_pi

def test_rotpsi():
    """
    Test rotation matrix generation.
    """
    # Test 0 radians
    expected_0 = np.array([
        [1.0, -0.0, 0.0],
        [0.0, 1.0, 0.0],
        [0.0, 0.0, 1.0]
    ])
    actual_0 = rotpsi(0.0)
    np.testing.assert_allclose(actual_0, expected_0, atol=1e-10)
    
    # Test pi/2 radians
    expected_pi_2 = np.array([
        [6.123233995736766e-17, -1.0, 0.0],
        [1.0, 6.123233995736766e-17, 0.0],
        [0.0, 0.0, 1.0]
    ])
    actual_pi_2 = rotpsi(math.pi/2)
    np.testing.assert_allclose(actual_pi_2, expected_pi_2, atol=1e-10)

def test_angle_to_two_pi():
    """
    Test angle normalization to [0, 2*pi].
    """
    # Negative angle
    expected_neg = 6.183185307179587 # -0.1 + 2*pi
    actual_neg = angle_to_two_pi(-0.1)
    assert actual_neg == pytest.approx(expected_neg)
    
    # Large angle
    expected_large = 0.7168146928204138 # 7.0 % (2*pi)
    actual_large = angle_to_two_pi(7.0)
    assert actual_large == pytest.approx(expected_large)
    
    # Exact 2*pi should go to 0
    assert angle_to_two_pi(2 * math.pi) == pytest.approx(0.0)
