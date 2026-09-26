import { createEslintConfig } from '@jankrajewskiit/configs/eslint';

export default createEslintConfig({
  tsconfigRootDir: import.meta.dirname,
  typedFiles: ['src/**/*.{ts,tsx,js,jsx}', 'tests/public-types.ts'],
});
