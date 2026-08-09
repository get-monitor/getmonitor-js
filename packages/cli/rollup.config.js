import typescript from '@rollup/plugin-typescript'

const external = ['node:fs', 'node:path', 'node:child_process', 'node:crypto']

export default [
  {
    input: 'src/index.ts',
    external,
    output: [
      { file: 'dist/index.js', format: 'esm', sourcemap: true },
      { file: 'dist/index.cjs', format: 'cjs', sourcemap: true },
    ],
    plugins: [typescript({ tsconfig: './tsconfig.json' })],
  },
  {
    input: 'src/bin.ts',
    external,
    output: {
      file: 'dist/bin.js',
      format: 'esm',
      sourcemap: true,
      banner: '#!/usr/bin/env node',
    },
    plugins: [typescript({ tsconfig: './tsconfig.json', declaration: false, declarationMap: false })],
  },
]
