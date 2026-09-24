import base from '@meca/eslint-config';
export default [...base, { ignores: ['tsup.config.ts', 'vitest.config.ts'] }];
