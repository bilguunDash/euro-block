import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { packagePrismaCli } from '../scripts/package-prisma-cli.cjs';

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'euroblock-deploy-test-'));
  const project = path.join(root, 'source');
  const stage = path.join(root, 'stage');
  fs.mkdirSync(project);
  fs.mkdirSync(stage);
  return { root, project, stage };
}

function cleanup(root: string) {
  assert.equal(path.dirname(path.resolve(root)), path.resolve(os.tmpdir()));
  assert.match(path.basename(root), /^euroblock-deploy-test-/);
  fs.rmSync(root, { recursive: true, force: true });
}

function write(directory: string, filename: string, content = '') {
  const target = path.join(directory, filename);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}

function packageFixture(project: string) {
  write(project, 'node_modules/prisma/package.json', JSON.stringify({ name: 'prisma', dependencies: { '@prisma/engines': '1', widget: '1' } }));
  write(project, 'node_modules/prisma/build/index.js', 'CLI fixture');
  write(project, 'node_modules/@prisma/engines/package.json', JSON.stringify({ name: '@prisma/engines' }));
  write(project, 'node_modules/@prisma/engines/schema-engine-windows.exe', 'engine fixture');
  write(project, 'node_modules/dotenv/package.json', JSON.stringify({ name: 'dotenv' }));
  write(project, 'node_modules/widget/package.json', JSON.stringify({ name: 'widget', dependencies: { dependency: '1' }, optionalDependencies: { absentOptional: '1' } }));
  write(project, 'node_modules/widget/node_modules/dependency/package.json', JSON.stringify({ name: 'dependency', version: '1' }));
  write(project, 'node_modules/dependency/package.json', JSON.stringify({ name: 'dependency', version: '2' }));
}

test('deploy package includes CLI, engine, dotenv and nested runtime versions without needing optional packages', () => {
  const { root, project, stage } = fixture();
  try {
    packageFixture(project);
    const result = packagePrismaCli(project, stage);
    assert.equal(result.packageCount, 5);
    assert.equal(fs.readFileSync(result.cliPath, 'utf8'), 'CLI fixture');
    assert.equal(fs.readFileSync(result.enginePath, 'utf8'), 'engine fixture');
    assert.ok(fs.existsSync(path.join(stage, 'node_modules/dotenv/package.json')));
    const nested = JSON.parse(fs.readFileSync(path.join(stage, 'node_modules/widget/node_modules/dependency/package.json'), 'utf8'));
    assert.equal(nested.version, '1');
    assert.equal(fs.existsSync(path.join(stage, 'node_modules/dependency/package.json')), false);
  } finally { cleanup(root); }
});

for (const [name, filename, error] of [
  ['missing CLI', 'node_modules/prisma/build/index.js', /CLI not found/],
  ['missing Windows engine', 'node_modules/@prisma/engines/schema-engine-windows.exe', /schema engine not found/],
  ['missing required runtime dependency', 'node_modules/widget/package.json', /dependency missing: widget/],
] as const) {
  test(`deploy packaging fails on ${name}`, () => {
    const { root, project, stage } = fixture();
    try {
      packageFixture(project);
      fs.unlinkSync(path.join(project, filename));
      assert.throws(() => packagePrismaCli(project, stage), error);
    } finally { cleanup(root); }
  });
}

test('deploy packaging rejects a staging destination that could overwrite installed packages', () => {
  const { root, project } = fixture();
  try {
    packageFixture(project);
    assert.throws(() => packagePrismaCli(project, project), /Staging directory must be separate/);
    assert.equal(fs.readFileSync(path.join(project, 'node_modules/prisma/build/index.js'), 'utf8'), 'CLI fixture');
  } finally { cleanup(root); }
});

const serverScript = path.resolve('deploy-server.ps1');
const powershell = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe');
const wrapper = `
param([string]$ServerScript, [string]$AppDir, [string]$Marker, [string]$Capture)
$ErrorActionPreference = 'Stop'
$env:DATABASE_URL = 'inherited-should-not-be-used'
$env:PRISMA_SCHEMA_ENGINE_BINARY = 'inherited-engine-should-not-be-used'
$env:BUG8_CAPTURE_PATH = $Capture
function Get-NetFirewallRule {
    param([string]$DisplayName)
    if ($env:DATABASE_URL -ne 'inherited-should-not-be-used') { throw 'DATABASE_URL was not restored' }
    if ($env:PRISMA_SCHEMA_ENGINE_BINARY -ne 'inherited-engine-should-not-be-used') { throw 'PRISMA_SCHEMA_ENGINE_BINARY was not restored' }
    [System.IO.File]::WriteAllText($Marker, 'migration succeeded; service setup may proceed')
    throw 'TEST_STOP_AFTER_MIGRATION'
}
try {
    & $ServerScript -AppDir $AppDir
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    throw 'Service setup unexpectedly completed'
} catch {
    if ($_.Exception.Message -eq 'TEST_STOP_AFTER_MIGRATION') { exit 0 }
    Write-Host $_.Exception.Message
    exit 99
}
`;

const cases = [
  { name: 'missing CLI', missing: 'node_modules/prisma/build/index.js' },
  { name: 'missing Windows engine', missing: 'node_modules/@prisma/engines/schema-engine-windows.exe' },
  { name: 'missing Prisma config', missing: 'prisma.config.ts' },
  { name: 'missing Prisma schema', missing: 'prisma/schema.prisma' },
  { name: 'missing migrations directory', emptyMigrations: true },
  { name: 'empty migrations directory', emptyMigrations: true, createMigrations: true },
  { name: 'missing DATABASE_URL', env: '# DATABASE_URL is absent' },
  { name: 'blank DATABASE_URL', env: 'DATABASE_URL=""' },
  { name: 'CLI failure', exitCode: 42 },
  { name: 'CLI success', exitCode: 0, success: true },
];

for (const scenario of cases) {
  test(`server deployment ${scenario.success ? 'proceeds after' : 'stops before service setup on'} ${scenario.name}`, { skip: process.platform !== 'win32' }, () => {
    const { root, stage } = fixture();
    const marker = path.join(root, 'service-setup.txt');
    const capture = path.join(root, 'cli-invocation.json');
    const wrapperPath = path.join(root, 'verify.ps1');
    try {
      write(stage, '.env.local', scenario.env ?? 'DATABASE_URL="postgresql://fixture-only/database"');
      write(stage, 'server.js');
      write(stage, 'prisma.config.ts');
      write(stage, 'prisma/schema.prisma');
      write(stage, 'node_modules/@prisma/engines/schema-engine-windows.exe', 'fixture engine');
      if (!scenario.emptyMigrations) write(stage, 'prisma/migrations/20260922000100_fixture/migration.sql', 'SELECT 1;');
      if (scenario.createMigrations) fs.mkdirSync(path.join(stage, 'prisma/migrations'));
      write(stage, 'node_modules/prisma/build/index.js', `
        require('fs').writeFileSync(process.env.BUG8_CAPTURE_PATH, JSON.stringify({ argv: process.argv.slice(2), cwd: process.cwd(), databaseUrl: process.env.DATABASE_URL, schemaEngine: process.env.PRISMA_SCHEMA_ENGINE_BINARY }));
        process.exit(${scenario.exitCode ?? 0});
      `);
      if (scenario.missing) fs.unlinkSync(path.join(stage, scenario.missing));
      fs.writeFileSync(wrapperPath, wrapper);
      let output = '';
      let exitCode = 0;
      try {
        output = execFileSync(powershell, ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', wrapperPath, '-ServerScript', serverScript, '-AppDir', stage, '-Marker', marker, '-Capture', capture], { encoding: 'utf8', timeout: 15000 });
      } catch (error) {
        const result = error as { status: number; stdout: string; stderr: string };
        exitCode = result.status;
        output = result.stdout + result.stderr;
      }
      assert.equal(exitCode, scenario.success ? 0 : 1, output);
      assert.equal(fs.existsSync(marker), Boolean(scenario.success), 'Failure must stop before firewall/service changes');
      assert.doesNotMatch(output, /\[WARN\]|skipping migration|Installation complete/);
      if (scenario.success) {
        assert.match(output, /Migration OK/);
        const invocation = JSON.parse(fs.readFileSync(capture, 'utf8'));
        assert.deepEqual(invocation.argv, ['migrate', 'deploy', '--config', path.join(stage, 'prisma.config.ts')]);
        assert.equal(invocation.cwd, stage);
        assert.equal(invocation.databaseUrl, 'postgresql://fixture-only/database');
        assert.equal(invocation.schemaEngine, path.join(stage, 'node_modules/@prisma/engines/schema-engine-windows.exe'));
      } else {
        assert.match(output, /\[ERROR\]/);
        assert.doesNotMatch(output, /Migration OK/);
        if (scenario.exitCode !== undefined) assert.match(output, /exit code 42/);
        else assert.equal(fs.existsSync(capture), false, 'Incomplete packages must fail before invoking CLI');
      }
    } finally { cleanup(root); }
  });
}
