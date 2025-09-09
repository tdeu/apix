module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\.ts$': 'ts-jest',
  },
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@cli/(.*)$': '<rootDir>/src/cli/$1',
    '^@analysis/(.*)$': '<rootDir>/src/analysis/$1',
    '^@planning/(.*)$': '<rootDir>/src/planning/$1',
    '^@hedera/(.*)$': '<rootDir>/src/hedera/$1',
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