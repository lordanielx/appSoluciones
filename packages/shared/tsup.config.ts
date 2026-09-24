import { defineConfig } from 'tsup';

export default defineConfig((options) => ({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  // En modo watch no se limpia dist: la API y la web lo consumen mientras se reconstruye.
  clean: !options.watch,
  target: 'es2022',
}));
