import typescript from '@rollup/plugin-typescript'

export default {
  input: 'src/index.ts',
  external: ['react', 'react/jsx-runtime', '@getmonitor/browser', '@getmonitor/core'],
  output: [
    { file: 'dist/index.js', format: 'esm', sourcemap: true, banner: "'use client'" },
    { file: 'dist/index.cjs', format: 'cjs', sourcemap: true, banner: "'use client'" },
  ],
  plugins: [typescript({ tsconfig: './tsconfig.json' })],
}
