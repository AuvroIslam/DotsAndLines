/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|firebase|@firebase/.*))',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@gameEngine/(.*)$': '<rootDir>/src/gameEngine/$1',
  },
  collectCoverageFrom: ['src/gameEngine/**/*.ts', 'src/utils/**/*.ts'],
};
