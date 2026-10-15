import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

function offlineApp() {
  return {
    name: 'krono-offline-app',
    apply: 'build',
    generateBundle(_options, bundle) {
      const files = [...Object.keys(bundle), 'manifest.webmanifest',
        'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png'];
      const template = readFileSync(new URL('./build/sw-template.js', import.meta.url), 'utf8');
      const hash = createHash('sha256').update(template);
      for (const output of Object.values(bundle)) hash.update(output.type === 'chunk' ? output.code : output.source);
      for (const file of files.filter(file => !bundle[file])) hash.update(readFileSync(new URL('./public/' + file, import.meta.url)));
      const source = template.replace('__CORE_FILES__', JSON.stringify(files)).replace('__VERSION__', hash.digest('hex').slice(0, 16));
      this.emitFile({type: 'asset', fileName: 'sw.js', source});
    }
  };
}
export default defineConfig({
  base: './',
  plugins: [offlineApp()],
  server: {port: 3000, host: '0.0.0.0', open: false}
});
