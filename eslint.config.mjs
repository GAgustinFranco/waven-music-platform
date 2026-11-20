import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const tsFiles = ['**/*.{ts,tsx,mts,cts}'];
const webFiles = ['apps/web/**/*.{ts,tsx,js,jsx,mjs}'];

// eslint-config-next ships its own `files` globs; scope every block to the web app.
const scopeToWeb = (configs) =>
  configs.map((config) =>
    Object.keys(config).length === 1 && config.ignores ? config : { ...config, files: webFiles },
  );

export default defineConfig([
  globalIgnores([
    '**/node_modules/**',
    '**/dist/**',
    '**/.next/**',
    '**/coverage/**',
    'apps/web/next-env.d.ts',
    'apps/web/src/lib/api/schema.ts',
  ]),

  js.configs.recommended,
  { files: ['*.{js,mjs}'], languageOptions: { globals: globals.node } },

  {
    files: tsFiles,
    extends: [tseslint.configs.strict],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/ban-ts-comment': [
        'error',
        { 'ts-ignore': true, 'ts-expect-error': 'allow-with-description' },
      ],
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },

  // API (NestJS, Node ESM)
  {
    files: ['apps/api/**/*.ts'],
    languageOptions: { globals: globals.node },
    rules: {
      // Nest's DI reads constructor parameter types at runtime through decorator
      // metadata, so those imports must stay value imports.
      '@typescript-eslint/consistent-type-imports': 'off',
      // Nest modules are intentionally empty classes decorated with @Module().
      '@typescript-eslint/no-extraneous-class': 'off',
    },
  },

  // Web (Next.js)
  ...scopeToWeb([...nextVitals, ...nextTs]),
  {
    files: webFiles,
    settings: { next: { rootDir: 'apps/web' }, react: { version: '19.3' } },
  },

  prettier,
]);
