// Copy installed Prisma CLI runtime packages without installing anything on the server.
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');

function isWithin(parent, target) {
  const relative = path.relative(parent, target);
  return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function findPackage(name, fromDirectory) {
  const resolver = createRequire(path.join(fromDirectory, 'package.json'));
  for (const directory of resolver.resolve.paths(name) || []) {
    const candidate = path.join(directory, name);
    if (fs.existsSync(path.join(candidate, 'package.json'))) return candidate;
  }
  return null;
}

function packagePrismaCli(projectRoot, stageDirectory) {
  projectRoot = path.resolve(projectRoot);
  stageDirectory = path.resolve(stageDirectory);
  const sourceModules = path.join(projectRoot, 'node_modules');
  if (isWithin(sourceModules, stageDirectory) || isWithin(stageDirectory, sourceModules)) {
    throw new Error('Staging directory must be separate from the project node_modules');
  }

  const cliDirectory = findPackage('prisma', projectRoot);
  if (!cliDirectory || !fs.existsSync(path.join(cliDirectory, 'build', 'index.js'))) {
    throw new Error('Installed Prisma CLI not found. Run npm ci before building the deploy package.');
  }
  const engineDirectory = findPackage('@prisma/engines', cliDirectory);
  const engineName = 'schema-engine-windows.exe';
  if (!engineDirectory || !fs.existsSync(path.join(engineDirectory, engineName))) {
    throw new Error('Prisma Windows schema engine not found. Build this Windows deploy package on Windows after npm ci.');
  }

  const copied = new Set();
  function copyPackage(name, fromDirectory, optional = false) {
    const source = findPackage(name, fromDirectory);
    if (!source) {
      if (optional) return;
      throw new Error(`Prisma CLI runtime dependency missing: ${name}`);
    }
    if (!isWithin(sourceModules, source)) {
      throw new Error(`Prisma CLI dependency is outside the project node_modules: ${name}`);
    }
    if (copied.has(source)) return;
    copied.add(source);

    const destination = path.join(stageDirectory, path.relative(projectRoot, source));
    fs.cpSync(source, destination, { recursive: true, force: true, dereference: true });
    const metadata = JSON.parse(fs.readFileSync(path.join(source, 'package.json'), 'utf8'));
    const optionalDependencies = metadata.optionalDependencies || {};
    for (const dependency of Object.keys(metadata.dependencies || {})) {
      copyPackage(dependency, source, Object.hasOwn(optionalDependencies, dependency));
    }
    for (const dependency of Object.keys(optionalDependencies)) {
      copyPackage(dependency, source, true);
    }
    for (const dependency of Object.keys(metadata.peerDependencies || {})) {
      if (!metadata.peerDependenciesMeta?.[dependency]?.optional) copyPackage(dependency, source);
    }
  }

  copyPackage('prisma', projectRoot);
  // prisma.config.ts imports dotenv/config; it is a dev dependency of this app.
  copyPackage('dotenv', projectRoot);
  return {
    packageCount: copied.size,
    cliPath: path.join(stageDirectory, path.relative(projectRoot, cliDirectory), 'build', 'index.js'),
    enginePath: path.join(stageDirectory, path.relative(projectRoot, engineDirectory), engineName),
  };
}

module.exports = { packagePrismaCli };

if (require.main === module) {
  try {
    if (process.argv.length !== 4) throw new Error('Usage: node package-prisma-cli.cjs <project-root> <stage-directory>');
    const result = packagePrismaCli(process.argv[2], process.argv[3]);
    console.log(`Prisma CLI: packaged ${result.packageCount} runtime packages and the Windows schema engine.`);
  } catch (error) {
    console.error(`[ERROR] ${error.message}`);
    process.exitCode = 1;
  }
}
