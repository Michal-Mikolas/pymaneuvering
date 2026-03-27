export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.m?[tj]s$': [
      'ts-jest',
      {
        useESM: true,
      },
    ],
  },
  testMatch: [
    '**/tests/**/*.test.ts',
    '**/lib/jsmaneuvering/tests/**/*.test.js',
    '**/lib/jsmaneuvering/tests/setup.test.js'
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/lib/jsmaneuvering/tests/testUtils.js'
  ],
  transformIgnorePatterns: [
    'node_modules/(?!(gl-matrix)/)'
  ],
};
