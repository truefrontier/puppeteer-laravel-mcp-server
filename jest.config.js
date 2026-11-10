// ESM + TypeScript. Run through `npm test`, which sets --experimental-vm-modules.
export default {
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' },
  transform: { '^.+\\.ts$': ['ts-jest', { useESM: true }] },
  testMatch: ['<rootDir>/src/**/*.test.ts'],
};
