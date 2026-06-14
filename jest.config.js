const nextJest = require('next/jest');

const createJestConfig = nextJest({
  // Path to the Next.js app to load next.config.js and .env files in the test env
  dir: './',
});

/** @type {import('jest').Config} */
const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/.next/'],
  collectCoverageFrom: [
    'lib/**/*.js',
    'pages/api/helpers/**/*.js',
    '!**/node_modules/**',
  ],
};

module.exports = createJestConfig(customJestConfig);
