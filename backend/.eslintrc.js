module.exports = {
  root: true,
  env: {
    browser: true,
    es2021: true,
  },
  extends: [
    "airbnb-base",
    "plugin:import/typescript",
    "plugin:@typescript-eslint/recommended",
    "prettier",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: "./tsconfig.json",
    tsconfigRootDir: "./",
  },
  plugins: ["@typescript-eslint"],
  rules: {
    "import/extensions": [
      "error",
      "ignorePackages",
      {
        js: "never",
        ts: "never",
      },
    ],
    "@typescript-eslint/explicit-function-return-type": 2,
    "import/prefer-default-export": "off",
    "class-methods-use-this": 0,
    "no-underscore-dangle": 0,
    "no-useless-constructor": 0,
    "no-empty-function": "off",
    "@typescript-eslint/no-empty-function": 0,
    "no-shadow": "off",
    "@typescript-eslint/no-shadow": ["error"],
    "lines-between-class-members": 0,
    "consistent-return": 0,
    "no-restricted-syntax": 0,
    "@typescript-eslint/no-unused-vars": ["error"],
    "@typescript-eslint/explicit-member-accessibility": [
      "error",
      { overrides: { parameterProperties: "off", constructors: "off" } },
    ],
    "max-lines-per-function": [
      "error",
      { max: 60, skipComments: true, skipBlankLines: true },
    ],
    complexity: ["error", 10],
    "no-console": "error",
    "max-len": ["error", 120],
    eqeqeq: "warn",
  },
  overrides: [
    {
      files: ["./tests/**/*"],
      rules: {
        "func-names": "off",
      },
    },
    {
      files: ["./src/api/route/**.route.ts"],
      rules: {
        "max-lines-per-function": ["off"],
      },
    },
  ],
  settings: {
    "import/resolver": {
      typescript: {
        alwaysTryTypes: true,
        project: "./",
      },
    },
    "import/parsers": {
      "@typescript-eslint/parser": [".ts"],
    },
  },
};
