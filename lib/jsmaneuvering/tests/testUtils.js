/**
 * Custom assertion for comparing arrays of numbers with floating point precision.
 * Similar to numpy.testing.assert_allclose.
 * @param {number[]|number[][]} actual 
 * @param {number[]|number[][]} expected 
 * @param {number} numDigits Number of digits after the decimal point to check.
 */
export function expectArraysToBeClose(actual, expected, numDigits = 5) {
  if (!Array.isArray(actual) || !Array.isArray(expected)) {
    throw new Error('Both inputs must be arrays');
  }

  if (actual.length !== expected.length) {
    throw new Error(`Array lengths do not match: actual ${actual.length}, expected ${expected.length}`);
  }

  for (let i = 0; i < actual.length; i++) {
    if (Array.isArray(actual[i]) && Array.isArray(expected[i])) {
      expectArraysToBeClose(actual[i], expected[i], numDigits);
    } else {
      expect(actual[i]).toBeCloseTo(expected[i], numDigits);
    }
  }
}
