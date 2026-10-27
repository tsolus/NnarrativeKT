import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Le build produit un seul fichier HTML autonome (dist/index.html) :
// c'est ce fichier qui est publié comme page Claude.
export default defineConfig({
  plugins: [preact(), viteSingleFile()],
  build: { outDir: 'dist', assetsInlineLimit: 100_000_000, cssCodeSplit: false, target: 'es2022' },
  test: { environment: 'jsdom', globals: true, include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'] },
});
