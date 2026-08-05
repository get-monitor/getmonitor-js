import typescript from '@rollup/plugin-typescript'
import resolve from '@rollup/plugin-node-resolve'

export default [
  {
    input: 'src/index.ts',
    external: ['@getmonitor/core'],
    output: [
      { file: 'dist/index.js', format: 'esm', sourcemap: true },
      { file: 'dist/index.cjs', format: 'cjs', sourcemap: true },
    ],
    plugins: [typescript({ tsconfig: './tsconfig.json' })],
  },
  {
    input: 'src/umd.ts',
    output: { file: 'dist/index.umd.js', format: 'umd', name: 'GetMonitor', exports: 'default', sourcemap: true },
    plugins: [
      resolve(),
      typescript({ tsconfig: './tsconfig.json', compilerOptions: { declaration: false, composite: false } }),
    ],
  },
]
