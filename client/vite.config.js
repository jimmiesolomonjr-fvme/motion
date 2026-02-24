import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

function writeVersion() {
  return {
    name: 'write-version',
    writeBundle(options) {
      const constantsPath = path.resolve(__dirname, 'src/utils/constants.js');
      const src = fs.readFileSync(constantsPath, 'utf-8');
      const match = src.match(/APP_VERSION\s*=\s*['"]([^'"]+)['"]/);
      if (match) {
        const outDir = options.dir || path.resolve(__dirname, 'dist');
        fs.writeFileSync(
          path.join(outDir, 'version.json'),
          JSON.stringify({ version: match[1] }) + '\n'
        );
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), writeVersion()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001',
      '/uploads': 'http://localhost:3001',
      '/socket.io': {
        target: 'http://localhost:3001',
        ws: true,
      },
    },
  },
});
