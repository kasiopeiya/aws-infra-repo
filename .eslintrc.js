/** @format */

module.exports = {
  env: {
    browser: true,
    es2021: true,
  },
  extends: "standard-with-typescript",
  overrides: [
    {
      env: {
        node: true,
      },
      files: [".eslintrc.{js,cjs}"],
      parserOptions: {
        sourceType: "script",
      },
    },
  ],
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
  },
  rules: {
    "no-new": "off",
    "no-tabs": "off",
    "@typescript-eslint/space-before-function-paren": "off",
    "@typescript-eslint/indent": "off",
  },
  ignorePatterns: [
    "**/tmp/**", "*.d.ts"
  ]
};
