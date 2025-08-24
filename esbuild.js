import esbuild from 'esbuild'
import { cpSync } from 'node:fs'
const outdir = 'dist'

const common = {
  entryPoints: [
    'src/background.ts',
    'src/ui/popup.ts',
    'src/ui/options.ts',
    'src/ui/report.ts',
    'src/ui/diff.ts'
  ],
  outdir,
  bundle: true,
  format: 'esm',
  sourcemap: true,
  platform: 'browser',
  target: ['chrome120'],
}

async function copyStatics() {
  const files = [
    ['manifest.json','manifest.json'],
    ['src/ui/popup.html','popup.html'],
    ['src/ui/options.html','options.html'],
    ['src/ui/report.html','report.html'],
    ['src/ui/diff.html','diff.html'],
    ['README.md','README.md']
  ]
  for (const [src, dest] of files) cpSync(src, `${outdir}/${dest}`, { recursive: true })
}

const watch = process.argv.includes('--watch')
if (watch) {
  esbuild.context(common).then(ctx => {
    ctx.watch()
    copyStatics()
    console.log('Watching... dist/')
  })
} else {
  esbuild.build(common).then(copyStatics)
}
