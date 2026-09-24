import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import base from './index.mjs';

export default tseslint.config(...base, {
  languageOptions: { globals: { ...globals.browser } },
  plugins: { 'react-hooks': reactHooks },
  rules: {
    ...reactHooks.configs.recommended.rules,
  },
});
