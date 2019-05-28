module.exports = {
  browser: true,
  moduleFileExtensions: ['js', 'json'],
  transform: {
    '^.+\\.(js|jsx)?$': 'babel-jest',
  },
  transformIgnorePatterns: [
    '/node_modules/', './dist/',
  ],
};
