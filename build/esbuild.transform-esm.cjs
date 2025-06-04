const { build } = require('esbuild');

const { esmImportTargets } = require('./esbuild.settings.cjs');

function transformEsmDeps() {
  return Promise.all(
    Object.entries(esmImportTargets).flatMap( ([id, { entry, outfile }]) => {
      console.log(`📦 Bundling ${id} to ${outfile}`);
      return build({
        entryPoints: [entry],
        outfile,
        bundle: true,
        format: 'cjs',
        platform: 'node',
        target: 'node16',
      });
    })
  );
}

transformEsmDeps().catch((err) => {
  console.error('❌ Failed to transform ESM dependencies:', err);
  process.exit(1);
});