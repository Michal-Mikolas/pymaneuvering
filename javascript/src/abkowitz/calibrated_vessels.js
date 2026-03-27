const gms_like_inland_barge = {
    "U_0": 2.777,
    "L": 105.0,
    "B": 9.5,
    "T": 2.8,
    "x_G": 0.887,
    "m": 2478451.0,
    "r_zz": 24.526,
    "rho": 1000.0,
    "X_0":        0.0,
    "X_udot": -  12.3,
    "X_u":    - 220.1,
    "X_uu":      72.4,
    "X_vv":   -  73.3,
    "X_vvvv":     0.0,
    "X_rr":   -   4.7,
    "X_vr":     279.2,
    "X_vvrr":    44.5,
    "X_dd":   -  88.7,
    "X_udd":    290.0,
    "Y_0":        0.0,
    "Y_vdot": - 311.7,
    "Y_rdot": -   4.2,
    "Y_v":    - 782.3,
    "Y_vvv":  -2814.1,
    "Y_r":       60.6,
    "Y_rrr":     23.4,
    "Y_vrr":  - 410.8,
    "Y_vvr":   1058.2,
    "Y_d":      135.7,
    "Y_ddd":  -  56.6,
    "Y_ud":   - 289.5,
    "Y_uddd":    98.5,
    "N_0":        0.0,
    "N_vdot": -   4.2,
    "N_rdot": -  19.3,
    "N_v":    - 230.8,
    "N_vvv":      0.0,
    "N_r":    -  90.9,
    "N_rrr":  -  40.4,
    "N_vrr":  - 101.1,
    "N_vvr":  - 833.2,
    "N_d":    -  64.4,
    "N_ddd":     27.1,
    "N_ud":     139.8,
    "N_uddd": -  47.5,
};

// Scale parameters by 10⁻⁵
for (let key in gms_like_inland_barge) {
    if (!["U_0", "L", "B", "T", "x_G", "m", "r_zz", "rho"].includes(key)) {
        gms_like_inland_barge[key] *= 1e-5;
    }
}

export const GMS_LIKE = gms_like_inland_barge;
