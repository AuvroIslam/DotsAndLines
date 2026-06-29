module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Reanimated 4 ships its Babel plugin via react-native-worklets.
      // This MUST be listed last.
      'react-native-worklets/plugin',
    ],
  };
};
