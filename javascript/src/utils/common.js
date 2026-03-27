import { mat3 } from 'gl-matrix';

export const angle_to_two_pi = (angle) => {
  const res = angle % (2 * Math.PI);
  return res < 0 ? res + 2 * Math.PI : res;
};

export const rotpsi = (psi, offset = 0.0) => {
  const angle = psi + offset;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [
    [c, -s, 0.0],
    [s, c, 0.0],
    [0.0, 0.0, 1.0]
  ];
};

export class MMGVessel {
  constructor(data) {
    Object.assign(this, data);
  }
}

export class AbkowitzVessel {
  constructor(data) {
    Object.assign(this, data);
  }
}

export class MinimalVessel {
  constructor(data) {
    Object.assign(this, data);
  }
}

export class InitialValues {
  constructor(data) {
    Object.assign(this, data);
  }
}
