# MMG Standard model with extensions for winds, currents and shallow water

In here you find an implementation of the [MMG standard model](https://doi.org/10.1007/s00773-014-0293-y) by Yasukawa, H., Yoshimura, Y. (2015).

## Installation

Install the package via pip:

```bash
pip install git+https://github.com/nikpau/mmgdynamics
```

## Dynamics

The MMG dynamics model can be used straight out of the box with any vessel listed in `calibrated_vessels.py`.
For most applications, you’ll want to use the `pstep()` function. This high-level method takes the vessel’s current global position, surge, sway, and yaw rate, along with optional environmental disturbances (water depth, wind speed/direction, current speed/direction). It directly returns the updated earth-fixed position and the new surge, sway, and yaw rates. This makes it the easiest entry point for integrating the MMG dynamics into your project.

If you need finer control over the calculations, use the lower-level `step()` function. This method takes the initial surge, sway, and yaw rate, plus vessel parameters and optional disturbances, and returns the raw first derivatives of these states. You’ll need to handle the integration and post-processing yourself.

The underlying dynamics are implemented in `dynamics.py`.
See the example below for how to call the model in your code.

```python
import math
import mmgdynamics as mmg
import mmgdynamics.calibrated_vessels as cvs
import matplotlib.pyplot as plt # Just for demostration

# Load a pre-calibrated vessel
vessel = mmg.Vessel(**cvs.kvlcc2_l64)

# Let the vessel drive with a rudder angle
# of 10° for 1000 seconds
# -------------------------------------
# Inital position
pos = [0,0] # x,y [m]

# Initial heading
psi = 0 # [rad]

# Random initial values (replace these with yours)
uvr = [3.85, 0, 0] # u,v,r [m/s, m/s, rad/s]

positions = []
for _ in range(1000):
    uvr, eta = mmg.pstep(
        X           = uvr,
        pos         = pos,
        vessel      = vessel,
        dT          = 1,    # 1 second
        nps         = 4,    # 4 revs per second
        delta       = 10 * (math.pi / 180), # Convert to radians
        psi         = psi,  # Heading
        water_depth = None, # No water depth
        fl_psi      = None, # No current angle
        fl_vel      = None, # No current velocity
        w_vel       = None, # No wind velocity
        beta_w      = None  # No wind angle
    )
    x,y,psi = eta # Unpack new position and heading
    positions.append([x,y]) # Store the new position
    pos = [x,y] # Update the position
    
# Quick plot of the trajectory
ps = list(zip(*positions))
plt.plot(ps[0], ps[1])
plt.show()
```

### Calibrate custom vessel

To calibrate a vessel not present in the `calibrated_vessels.py` file, you can define a minimal dict with basic information about the vessel and use `calibrate()` to make it usable in the `step()` function. Several empirical formulas will be used to estimate the relevant hydrodynamic derivatives for your vessel and return a dict, which can be used as an input to the `step()` function.
> Disclaimer: The quality of the empirical estimations for hydrodynamic derivatives varies greatly for different ships. Please consider comprehensive testing before using a custom vessel.

#### Calibration process:

Under `src/structs.py`, you will find the dataclasses responsible for modeling the vessel objects. For using a minimal dict as a vessel, you must define it as seen below and then pass it into the `calibrate()` function which returns a full vessel object.

The empirical estimations need at least the following information:

```python
from mmgdynamics.structs import MinimalVessel
from mmgdynamics.dynamics import calibrate

my_vessel = {
  "m":        0.0, # Vessel displacement [m³]
  "B":        0.0, # Vessel Breadth (width)
  "Lpp":      0.0, # Length between perpendiculars
  "C_b":      0.0, # Block coefficient (< 0.8)
  "D_p":      0.0, # Propeller Diameter
  "eta":      0.0, # Ratio of propeller diameter to rudder span
  "f_alpha":  0.0  # Rudder lift gradient coefficient 
                   # (If not given you will be asked for the rudder aspect ratio)
}

# To create a complete vessel object, you must pass
# the minimal dict and the water density of your environment 
# into the calibrate function as a minimal Vessel:
full_vessel = calibrate(MinimalVessel(**my_vessel),rho = 1000)
```

### Extension for winds and currents

Current and wind forces are calculated according to [Fossen, 2011](https://doi.org/10.1002/9781119994138):

The angle of attack for currents is set as an angle from the global reference frame. 0° current are parallel to the x-axis. Angles rotate clockwise, directions are modeled as `coming from`. (Wind direction of 0° with positive speed means wind flows from east to west. Similarly, a current direction of 90° with positive speed means the current flows from north to south.)

### Shallow water adaption

The effects of shallow water are incorporated using various semi-empirical formulas summarized in [Taimuri et. al. (2020)](https://doi.org/10.1016/j.oceaneng.2020.108103)

## Examples

You can find common test cases for vessel maneuvering, such as the ZigZag or turning maneuver test, in the `example.py` file.


## Citation

If you use this code in one of your projects or papers, please cite it as follows:

```bibtex
@misc{mmgdynamics,
  author = {Niklas Paulig},
  title = {MMG standard model for ship maneuvering},
  year = {2024},
  publisher = {GitHub},
  journal = {GitHub Repository},
  howpublished = {\url{https://github.com/nikpau/mmgdynamics}}
}
```
