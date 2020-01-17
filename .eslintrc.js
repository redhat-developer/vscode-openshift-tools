module.exports = {
    root: true,
    parser: '@typescript-eslint/parser',
    env: {
        node: true
    },
    parserOptions: {
        "sourceType": "module",
    },
    plugins: [
        '@typescript-eslint',
        'header',
    ],
    extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/eslint-recommended',
        'plugin:@typescript-eslint/recommended',
    ],
    rules: {
        "header/header": [2, "./header.js"],
        "@typescript-eslint/no-use-before-define": ["error", { "functions": false, "classes": false }],
        '@typescript-eslint/no-unused-vars': [1],
        "@typescript-eslint/explicit-function-return-type": [1, { "allowExpressions": true }]
    },

};