/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  coverageProvider: 'v8',
  globals: {
    'ts-jest': {
      tsconfig: {
        "target": "ES2017",
        "noUnusedLocals": false,
        "sourceMap": true,
      }
    }
  }
};