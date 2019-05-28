module.exports = {
  plugins: ['@babel/plugin-transform-async-to-generator', '@babel/plugin-proposal-object-rest-spread'],
  presets: [
    [
      '@babel/preset-env',
      {
        targets: {
          node: 'current',
        },
        modules: false,
        useBuiltIns: 'usage',
        corejs: { version: 3, proposals: true },
      },
    ],
  ],
  env: {
    test: {
      presets: [[
        '@babel/preset-env', {
          targets: {
            node: 'current',
          },
        },
      ]],
    },
  },
};
