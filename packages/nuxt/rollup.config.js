import typescript from '@rollup/plugin-typescript'

export default {
  input: 'src/index.ts',
  external: ['@getmonitor/cli', '@nuxt/kit'],
  output: [
    { file: 'dist/index.js', format: 'esm', sourcemap: true },
    { file: 'dist/index.cjs', format: 'cjs', sourcemap: true },
  ],
  plugins: [typescript({ tsconfig: './tsconfig.json' })],
}
