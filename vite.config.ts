import { createSolidLibViteConfig } from '@jankrajewskiit/configs/vite';
import { defineConfig } from 'vite';

export default defineConfig(async () =>
  createSolidLibViteConfig(
    {},
    {
      fileName: 'velvet-reactive',
      externalPackages: ['solid-js'],
      dts: { tsconfigPath: './tsconfig.app.json' },
    },
  ),
);
