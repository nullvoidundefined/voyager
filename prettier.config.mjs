export default {
  arrowParens: 'always',
  bracketSpacing: true,
  htmlWhitespaceSensitivity: 'css',
  importOrder: [
    '^node:',
    '^react$',
    '^react-dom',
    '^next',
    '<THIRD_PARTY_MODULES>',
    '^app/',
    '^@/',
    '^\\.\\./',
    '^\\./',
  ],
  importOrderSeparation: true,
  importOrderSortSpecifiers: true,
  jsxSingleQuote: true,
  overrides: [
    {
      files: ['*.json'],
      options: {
        parser: 'json5',
        quoteProps: 'preserve',
        singleQuote: false,
        trailingComma: 'none',
      },
    },
    {
      files: ['.*rc'],
      options: {
        parser: 'json5',
        quoteProps: 'preserve',
        singleQuote: false,
        trailingComma: 'none',
      },
    },
    {
      files: ['*.yml', '*.yaml'],
      options: {
        singleQuote: true,
      },
    },
  ],
  plugins: ['@trivago/prettier-plugin-sort-imports'],
  printWidth: 80,
  quoteProps: 'as-needed',
  semi: true,
  singleQuote: true,
  tabWidth: 2,
  trailingComma: 'all',
  useTabs: false,
};
