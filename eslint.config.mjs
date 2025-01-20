// eslint.config.mjs (without defineConfig)
import eslint from '@eslint/js';
import tsEslintPlugin from "@typescript-eslint/eslint-plugin";
import tsEslintParser from "@typescript-eslint/parser";
import prettierPlugin from 'eslint-config-prettier';
import headerPlugin from 'eslint-plugin-header';
import importPlugin from 'eslint-plugin-import';
import jsdocPlugin from 'eslint-plugin-jsdoc';
import globals from "globals";
import tseslint from 'typescript-eslint';

headerPlugin.rules.header.meta.schema = false;

export default [
  prettierPlugin,
  {
    files: [
      '**/*.ts',
      '**/*.tsx'
    ],
    languageOptions: {
      parser: tsEslintParser,
      ecmaVersion: 2022,
      sourceType: "module",
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.jsx,
        ...globals.jasmine,
        ...globals.mocha,
        ...globals.react
      }
    },
    plugins: {
      '@typescript-eslint': tsEslintPlugin,
      'prettier': prettierPlugin,
      'header': headerPlugin,
      'import': importPlugin,
      'jsdoc': jsdocPlugin
    },
    settings: {
      "import/core-modules": [ "vscode", "react" ],
      "import/extensions": [ ".js", ".jsx", ".tsx", ".ts" ],
      "import/parsers": {
        "@typescript-eslint/parser": [".ts", ".tsx"]
      },
      "import/resolver": {
        "typescript": {},
        "node": {
          "extensions": [
            ".js",
            ".jsx",
            ".tsx",
            ".ts"
          ]
        }
      },
    },
    rules: {
      // Manually add rules from eslint:recommended
      ...eslint.configs.recommended.rules,

      // Manually add rules from @typescript-eslint/recommended
      ...tseslint.configs.recommended.rules,
      ...tseslint.configs.recommendedTypeChecked.rules,

      // Header rules
      'header/header': ['error', './header.js'],

      // Import rules
      'import/no-duplicates': ['error'],
      'import/prefer-default-export': 'off',
      'import/extensions': [
        'error',
        'ignorePackages',
        {
          js: 'never',
          jsx: 'never',
          ts: 'never',
          tsx: 'never'
        }
      ],
      'import/no-unresolved': [
        'error',
        {
          ignore: ['^src/'], // Ignore specific paths, like `src/` in your project
        },
      ],

      // Other rules
      'camelcase': 'error',
      'consistent-return': 'off',
      'consistent-this': ['warn', 'that'],
      'curly': ['error', 'multi-line'],
      'default-case': ['error'],
      'dot-notation': ['error'],
      'eqeqeq': ['error', 'allow-null'],
      'guard-for-in': 'error',
      'max-nested-callbacks': [1, 4],
      'max-classes-per-file': [0],
      'no-alert': 'error',
      'no-caller': 'error',
      'no-constant-condition': 'error',
      'no-console': 'error',
      'no-multiple-empty-lines': ['warn', { 'max': 1, 'maxEOF': 0 }],
      'no-debugger': 'error',
      'no-else-return': ['error'],
      'no-global-strict': 'off',
      'no-irregular-whitespace': ['error'],
      'no-param-reassign': ['error', { 'props': false }],
      'no-redeclare': 'off',
      'no-shadow': 'warn',
      'no-underscore-dangle': 'off',
      'no-unused-vars': 'off', // Will be processed by '@eslint-typescript/no-unused-vars'
      'no-useless-constructor': 'off',
      'no-var': 'error',
      'object-shorthand': ['error', 'properties'],
      'prefer-const': ['error', { 'destructuring': 'all' }],
      'prefer-template': 'error',
      'radix': 'error',
      'no-trailing-spaces': 'error',
      'quotes': [ 'error', 'single'],

      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/unbound-method': ['error', { 'ignoreStatic': true }],
      '@typescript-eslint/restrict-template-expressions': 'warn',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-redeclare': 'error',
      '@typescript-eslint/no-unsafe-return': 'warn',
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      '@typescript-eslint/no-unsafe-call': 'warn',
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-var-requires': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      '@typescript-eslint/no-unused-expressions': 'off',
      '@typescript-eslint/prefer-regexp-exec': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error', {
          'vars': 'local',
          'args': 'none', // Check args after they're used
          'caughtErrors': 'none', // Disable checking for caught errors
        }
      ],
      '@typescript-eslint/no-explicit-any': 'warn',

      'jsdoc/check-tag-names': 'error',
      'jsdoc/check-param-names': ['error', { 'checkDestructured': false }],
      'jsdoc/check-alignment': 'error',
      'jsdoc/no-multi-asterisks': 'error',
      'jsdoc/no-types': 'error',
      'jsdoc/require-param-name': 'error',
      'jsdoc/require-returns-check': 'error',
      'jsdoc/require-returns-description': 'error'
    }
  },
  {
    // Workaround for "X:YY error 'Thenable' is not defined  no-undef" when a JS type is imported to a TS
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsEslintParser,
    },
    rules: {
      'no-undef': 'off'
    }
  },
  {
    ignores: [
      'node_modules',
      'out',
      '.vscode-test',
      '.yarn',
      'images',
      'doc/images',
      '__coverage__',
      'coverage',
      'public/dist',
      '*.min.js',
      'public/lib',
      'Godeps',
      'test-resources',
      'test/sandbox-registration',
      // vendored from https://github.com/IonicaBizau/git-url-parse, see https://github.com/IonicaBizau/git-url-parse/pull/159
      'src/util/gitParse.ts'
    ] // Files or directories to ignore
  },
  {
    files: ['src/@types/*.d.ts', 'src/webview/@types/*.d.ts'],
    rules: {
      // Header rules
      'header/header': 'off',
      'no-undef': 'off'
    }
  },
  {
    files: ['**/*.test.ts'],
    rules: {
      'no-unused-expressions': 'off',
      'max-nested-callbacks': 'off',
      '@typescript-eslint/unbound-method': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'warn',
    },
  },
];