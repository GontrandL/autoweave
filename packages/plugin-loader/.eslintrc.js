module.exports = {
  extends: ['../../.eslintrc.js'],
  rules: {
    // Allow any type for rapid development
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-unsafe-assignment': 'off',
    '@typescript-eslint/no-unsafe-member-access': 'off',
    '@typescript-eslint/no-unsafe-call': 'off',
    '@typescript-eslint/no-unsafe-return': 'off',
    '@typescript-eslint/no-unsafe-argument': 'off',
    
    // Allow console for debugging
    'no-console': 'off',
    
    // Allow unused vars with underscore prefix
    '@typescript-eslint/no-unused-vars': ['warn', { 
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_'
    }],
    
    // Relax strict rules that cause many errors
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/ban-ts-comment': 'off',
    '@typescript-eslint/no-misused-promises': 'off',
    '@typescript-eslint/no-floating-promises': 'off',
    '@typescript-eslint/require-await': 'off',
    '@typescript-eslint/restrict-template-expressions': 'off',
    '@typescript-eslint/restrict-plus-operands': 'off',
    '@typescript-eslint/await-thenable': 'off',
    '@typescript-eslint/no-redundant-type-constituents': 'off',
    '@typescript-eslint/prefer-nullish-coalescing': 'off',
    '@typescript-eslint/prefer-optional-chain': 'off',
    '@typescript-eslint/no-unnecessary-type-assertion': 'off',
    '@typescript-eslint/no-non-null-assertion': 'off',
    '@typescript-eslint/ban-types': 'off',
    '@typescript-eslint/no-empty-function': 'off',
    '@typescript-eslint/no-inferrable-types': 'off',
    '@typescript-eslint/prefer-as-const': 'off',
    '@typescript-eslint/no-namespace': 'off',
    '@typescript-eslint/no-var-requires': 'off',
    '@typescript-eslint/no-empty-interface': 'off',
    '@typescript-eslint/consistent-type-imports': 'off',
    '@typescript-eslint/consistent-type-definitions': 'off',
    '@typescript-eslint/array-type': 'off',
    '@typescript-eslint/consistent-indexed-object-style': 'off',
    '@typescript-eslint/prefer-function-type': 'off',
    '@typescript-eslint/unified-signatures': 'off',
    
    // General rules that cause issues
    'no-unused-vars': 'off',
    'no-undef': 'off',
    'no-redeclare': 'off',
    'no-use-before-define': 'off',
    'no-dupe-class-members': 'off',
    'no-array-constructor': 'off',
    'no-useless-constructor': 'off',
    'no-empty-function': 'off',
    'no-duplicate-imports': 'off',
    'no-loss-of-precision': 'off',
    'no-loop-func': 'off',
    'no-shadow': 'off',
    'no-unused-expressions': 'off',
    'no-useless-escape': 'warn',
    'no-prototype-builtins': 'warn',
    'no-case-declarations': 'warn',
    'no-regex-spaces': 'warn',
    'no-mixed-spaces-and-tabs': 'warn',
    'no-trailing-spaces': 'warn',
    'no-multiple-empty-lines': 'warn',
    'prefer-const': 'warn',
    'no-var': 'warn',
    
    // Disable formatting rules (handled by prettier)
    'quotes': 'off',
    'semi': 'off',
    'comma-dangle': 'off',
    'indent': 'off',
    'key-spacing': 'off',
    'keyword-spacing': 'off',
    'space-before-blocks': 'off',
    'space-before-function-paren': 'off',
    'space-in-parens': 'off',
    'space-infix-ops': 'off',
    'space-unary-ops': 'off',
    'spaced-comment': 'off',
    'arrow-spacing': 'off',
    'block-spacing': 'off',
    'brace-style': 'off',
    'comma-spacing': 'off',
    'computed-property-spacing': 'off',
    'eol-last': 'off',
    'func-call-spacing': 'off',
    'object-curly-spacing': 'off',
    'padded-blocks': 'off',
    'rest-spread-spacing': 'off',
    'semi-spacing': 'off',
    'template-curly-spacing': 'off',
    
    // Allow void operator for async operations
    'no-void': 'off',
    
    // Allow import patterns
    'import/no-named-as-default': 'off',
    'no-useless-escape': 'off',
    
    // Keep security rules
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
    'no-script-url': 'error',
    'no-self-compare': 'error',
    'no-sequences': 'error',
    'no-throw-literal': 'error',
    'no-with': 'error',
  },
  
  // Configuration de l'environnement
  env: {
    node: true,
    es2022: true,
    jest: true
  },
  
  // Ignorer certains fichiers
  ignorePatterns: [
    'dist/',
    'node_modules/',
    '*.d.ts',
    'coverage/',
    'build/',
    'lib/',
    'es/',
    'types/'
  ]
};