import { rotpsi, angle_to_two_pi } from '../src/utils/common.js';
import { expectArraysToBeClose } from './testUtils.js';

describe('Common Utilities', () => {
  describe('rotpsi', () => {
    it('generates correct rotation matrix for 0 radians', () => {
      const expected = [
        [1.0, -0.0, 0.0],
        [0.0, 1.0, 0.0],
        [0.0, 0.0, 1.0]
      ];
      const actual = rotpsi(0.0);
      expectArraysToBeClose(actual, expected, 10);
    });

    it('generates correct rotation matrix for pi/2 radians', () => {
      const expected = [
        [6.123233995736766e-17, -1.0, 0.0],
        [1.0, 6.123233995736766e-17, 0.0],
        [0.0, 0.0, 1.0]
      ];
      const actual = rotpsi(Math.PI / 2);
      expectArraysToBeClose(actual, expected, 10);
    });
  });

  describe('angle_to_two_pi', () => {
    it('normalizes negative angles', () => {
      const expected = 6.183185307179587; // -0.1 + 2*pi
      const actual = angle_to_two_pi(-0.1);
      expect(actual).toBeCloseTo(expected, 10);
    });

    it('normalizes large angles', () => {
      const expected = 0.7168146928204138; // 7.0 % (2*pi)
      const actual = angle_to_two_pi(7.0);
      expect(actual).toBeCloseTo(expected, 10);
    });

    it('normalizes 2*pi to 0', () => {
      const actual = angle_to_two_pi(2 * Math.PI);
      expect(actual).toBeCloseTo(0.0, 10);
    });
  });
});
