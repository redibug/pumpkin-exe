import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Dev-only endpoint so the in-game debug overlay can write its tuning to
// grid-config.local.json (gitignored — personal tuning never clobbers the
// committed defaults). Not present in production builds (the overlay falls
// back to downloading the JSON).
function gridConfigSave() {
  return {
    name: 'grid-config-save',
    configureServer(server) {
      server.middlewares.use('/__grid-config-local', (req, res, next) => {
        if (req.method !== 'POST') return next();
        let body = '';
        req.on('data', (c) => { body += c; });
        req.on('end', () => {
          try {
            const data = JSON.parse(body);
            const file = path.resolve(__dirname, 'grid-config.local.json');
            fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end('{"ok":true}');
          } catch {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end('{"ok":false}');
          }
        });
      });
    },
  };
}

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0,
  },
  plugins: [gridConfigSave()],
});
