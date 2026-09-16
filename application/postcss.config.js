export default {
  plugins: {
    '@csstools/postcss-color-mix-function': { preserve: true },
    '@csstools/postcss-oklab-function': { preserve: true },
    'postcss-preset-env': {
      stage: 3,
      browsers: 'safari >= 15',
    },
  },
};
