module.exports = {
  moduleFileExtensions: ['js', 'json'],
  transform: {
    '^.+\\.(js|jsx)?$': 'babel-jest',
  },
  transformIgnorePatterns: [
    '/node_modules/', './dist/',
  ],
  coverageDirectory: './coverage/',
  collectCoverage: true,
};
