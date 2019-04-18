module.exports = {
  browser: true,
  moduleFileExtensions: ['js','json'],
  transform: {
    '^.+\\.(js|jsx)?$': 'babel-jest'
  },
  transformIgnorePatterns: ['<rootDir>/node_modules/']
};