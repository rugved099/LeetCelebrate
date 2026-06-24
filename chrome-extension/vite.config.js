import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import fs from 'fs';

// Helper custom plugin to copy manifest.json and static assets to dist/ after bundling
function copyStaticAssetsPlugin() {
  return {
    name: 'copy-static-assets',
    closeBundle() {
      // Copy manifest.json
      const srcManifest = resolve(__dirname, 'manifest.json');
      const distManifest = resolve(__dirname, 'dist/manifest.json');
      fs.copyFileSync(srcManifest, distManifest);
      console.log('✓ manifest.json copied to dist/');

      // Copy content script CSS (celebration overlay styles)
      const srcStyles = resolve(__dirname, 'src/content/styles.css');
      const distStyles = resolve(__dirname, 'dist/styles.css');
      if (fs.existsSync(srcStyles)) {
        fs.copyFileSync(srcStyles, distStyles);
        console.log('✓ styles.css copied to dist/');
      }

      // Copy icons directory
      const srcIcons = resolve(__dirname, 'public/icons');
      const distIcons = resolve(__dirname, 'dist/icons');
      if (fs.existsSync(srcIcons)) {
        fs.mkdirSync(distIcons, { recursive: true });
        fs.readdirSync(srcIcons).forEach(file => {
          fs.copyFileSync(resolve(srcIcons, file), resolve(distIcons, file));
        });
        console.log('✓ icons/ copied to dist/');
      }
    }
  };
}

export default defineConfig({
  plugins: [react(), copyStaticAssetsPlugin()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'index.html'),
        background: resolve(__dirname, 'src/background/background.js'),
        content: resolve(__dirname, 'src/content/content.js'),
        interceptor: resolve(__dirname, 'src/content/interceptor.js'),
        'auth-content': resolve(__dirname, 'src/content/auth-content.js'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]',
      },
    },
  },
});
