// https://docs.expo.dev/guides/using-eslint/
module.exports = {
  root: true,
  extends: ['expo', 'prettier'],
  plugins: ['prettier'],
  rules: {
    'prettier/prettier': 'warn',
    'import/order': [
      'warn',
      {
        groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
        'newlines-between': 'always',
        alphabetize: { order: 'asc', caseInsensitive: true },
      },
    ],
    '@typescript-eslint/no-unused-vars': [
      'warn',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
  },
  // `functions/` is a separate package with its own toolchain (Admin SDK,
  // Node runtime); it is linted/built from within that directory.
  ignorePatterns: ['/dist/*', '/node_modules/*', '/.expo/*', '/functions/*'],
};
