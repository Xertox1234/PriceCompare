/**
 * Local ESLint Rules Plugin
 * 
 * Custom rules for PriceCompare project to enforce project-specific patterns.
 * 
 * Usage in eslint config:
 *   plugins: { 'local': require('./scripts/eslint-rules') }
 *   rules: { 'local/no-n-plus-one': 'error' }
 */

module.exports = {
  rules: {
    'no-n-plus-one': require('./no-n-plus-one.cjs'),
  },
};
