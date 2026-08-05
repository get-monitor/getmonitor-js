import typescript from '@rollup/plugin-typescript'

export default {
  input: 'src/index.ts',
  external: ['@getmonitor/core', 'node:os', 'node:async_hooks', 'express'],
  output: [
    { file: 'dist/index.js', format: 'esm', sourcemap: true },
    { file: 'dist/index.cjs', format: 'cjs', sourcemap: true },
  ],
  plugins: [typescript({ tsconfig: './tsconfig.json' })],
}
