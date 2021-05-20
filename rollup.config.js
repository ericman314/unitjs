import babel from 'rollup-plugin-babel'
import typescript from 'rollup-plugin-typescript2'
import commonjs from 'rollup-plugin-commonjs'
import { terser } from 'rollup-plugin-terser'

const teserOptions = {
  compress: {
    pure_getters: true,
    unsafe: true,
    unsafe_comps: true
  }
}

const babelOptions = {
  presets: [
    ['@babel/preset-env', {
      useBuiltIns: 'usage',
      debug: true,
      corejs: 3
    }]
  ],
  ignore: [
    'node_modules'
  ]
}

const tsOptions = {
  check: true,
  abortOnError: true
}

const tsOptionsDeclaration = {
  ...tsOptions,
  useTsconfigDeclarationDir: true,
  tsconfigOverride: {
    compilerOptions: {
      declaration: true,
      emitDeclarationOnly: true,
      outFile: 'es/UnitMath.d.ts'
    }
  }
}

const name = 'UnitMath'
const input = 'src/Unit.ts'

export default [
  // UMD build
  {
    input,
    output: {
      name,
      file: 'dist/UnitMath.js',
      format: 'umd'
    },
    plugins: [
      typescript(tsOptions),
      babel(babelOptions),
      commonjs()
    ]
  },
  // minified UMD build
  {
    input,
    output: {
      file: 'dist/UnitMath.min.js',
      format: 'umd',
      indent: false,
      name
    },
    plugins: [
      typescript(tsOptions),
      babel(babelOptions),
      commonjs(),
      terser(teserOptions)
    ]
  },
  // minified UMD build
  {
    input,
    output: {
      file: 'dist/UnitMath.min2.js',
      format: 'umd',
      indent: false,
      name
    },
    plugins: [
      typescript(tsOptions),
      terser(teserOptions)
    ]
  },
  // es build
  {
    input,
    output: {
      file: 'es/UnitMath.js',
      format: 'es'
    },
    plugins: [
      typescript(tsOptions)
    ]
  },
  // d.ts build
  {
    input,
    plugins: [
      typescript(tsOptionsDeclaration)
    ]
  },
  // minified es build
  {
    input,
    output: {
      file: 'es/UnitMath.min.js',
      format: 'es',
      indent: false
    },
    plugins: [
      typescript(tsOptions),
      terser(teserOptions)
    ]
  }
]
