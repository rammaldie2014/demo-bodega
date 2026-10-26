import js from '@eslint/js';
import ts from 'typescript-eslint';
import angular from 'angular-eslint';
export default ts.config(
  { ignores: ['dist/**', 'node_modules/**', 'test-results/**', 'playwright-report/**'] },
  {
    files: ['**/*.ts'],
    extends: [js.configs.recommended, ...ts.configs.recommended, ...angular.configs.tsRecommended],
    processor: angular.processInlineTemplates,
  },
  {
    files: ['**/*.html'],
    extends: [...angular.configs.templateRecommended, ...angular.configs.templateAccessibility],
  },
);
