import { defineConfig } from 'tsup';
export default defineConfig({
  entry: [
    'src/index.ts',
    'src/nodes/Codestra.node.ts',
    'src/nodes/CodestraTrigger.node.ts',
    'src/credentials/CodestraApi.credentials.ts',
  ],
  format: ['cjs'],
  dts: true,
  clean: true,
  outDir: 'dist',
});
