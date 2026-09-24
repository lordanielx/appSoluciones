import base from '@meca/eslint-config';

export default [
  ...base,
  {
    rules: {
      // Nest necesita importaciones de valor para la metadata de inyección de dependencias.
      '@typescript-eslint/consistent-type-imports': 'off',
    },
  },
  { ignores: ['jest.config.js'] },
];
