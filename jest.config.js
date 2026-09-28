module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  // Also the default for beforeAll/afterAll hooks; the generation tests render
  // and write real projects, which is slow when all suites run in parallel
  testTimeout: 30000,
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\.ts$': 'ts-jest',
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@cli/(.*)$': '<rootDir>/src/cli/$1',
    '^@analysis/(.*)$': '<rootDir>/src/analysis/$1',
    '^@planning/(.*)$': '<rootDir>/src/planning/$1',
    '^@templates/(.*)$': '<rootDir>/src/templates/$1',
    '^@generation/(.*)$': '<rootDir>/src/generation/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1'
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
  ],
};
