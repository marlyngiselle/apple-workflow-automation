import js from '@eslint/js';
import globals from 'globals';

// JXA globals, available only inside osascript. They are allowed in src/jxa and nowhere else,
// which keeps src/core free of anything that would stop it running under Node.
const jxaGlobals = {
  Application: 'readonly',
  ObjC: 'readonly',
  $: 'readonly',
  Path: 'readonly',
  delay: 'readonly',
};

export default [
  { ignores: ['dist/', 'node_modules/', 'coverage/'] },
  js.configs.recommended,
  {
    languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
    linterOptions: { reportUnusedDisableDirectives: 'error' },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'none' }],
      'no-var': 'error',
      'prefer-const': 'error',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-console': 'off',
    },
  },
  {
    files: ['src/core/**/*.mjs'],
    languageOptions: { globals: {} },
    rules: {
      'no-restricted-globals': ['error', 'process', 'require', 'Buffer', 'Application', 'ObjC', '$'],
    },
  },
  {
    files: ['src/jxa/**/*.mjs'],
    languageOptions: { globals: jxaGlobals },
  },
  {
    files: ['scripts/**/*.mjs', 'tests/**/*.mjs', 'eslint.config.js'],
    languageOptions: { globals: globals.node },
  },
];
