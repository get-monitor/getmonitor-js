import typescript from '@rollup/plugin-typescript'

const external = ['@getmonitor/core', 'node:os', 'node:async_hooks', 'express', 'fastify', 'koa', 'hono']

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
    input: 'src/extensions/nestjs.ts',
    external: [...external, '@nestjs/common', '@nestjs/core', 'reflect-metadata'],
    output: [
      { file: 'dist/nestjs.js', format: 'esm', sourcemap: true },
      { file: 'dist/nestjs.cjs', format: 'cjs', sourcemap: true },
    ],
    // Uses a dedicated tsconfig (rootDir: src/extensions, include: just nestjs.ts) so the
    // emitted declaration flattens to dist/nestjs.d.ts (matching dist/nestjs.js/.cjs above)
    // instead of dist/extensions/nestjs.d.ts. Reusing tsconfig.json's rootDir override here
    // would apply to its whole "include": ["src"] program, not just this entry, and corrupt
    // the src/index.ts build's declaration output (verified empirically).
    plugins: [typescript({ tsconfig: './tsconfig.nestjs.json' })],
  },
]
