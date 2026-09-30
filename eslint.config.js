// @ts-check
const { defineConfig } = require('eslint/config');
const eslint = require('@eslint/js');
const tseslint = require('typescript-eslint');

module.exports = defineConfig(
  { ignores: ['dist/', 'lib/', 'templates/', 'node_modules/'] },
  eslint.configs.recommended,
  tseslint.configs.recommended,
  {
    // Rules with existing violations in src/, downgraded to warnings until the
    // code is cleaned up (see BACKLOG.md, Phase 5). New violations still show.
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-require-imports': 'warn',
      '@typescript-eslint/no-this-alias': 'warn',
      'no-case-declarations': 'warn',
      'no-async-promise-executor': 'warn',
      'no-control-regex': 'warn',
      'no-useless-escape': 'warn',
      'prefer-const': 'warn',
    },
  },
);
