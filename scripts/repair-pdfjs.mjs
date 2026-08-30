import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const PDFJS_VERSION = '6.2.108';
const MINIMUM_NODE = [22, 13, 0];
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, '..');
const nodeModules = path.join(projectRoot, 'node_modules');
const pdfjsRoot = path.join(nodeModules, 'pdfjs-dist');
const requiredFiles = [
  path.join(pdfjsRoot, 'package.json'),
  path.join(pdfjsRoot, 'build', 'pdf.mjs'),
  path.join(pdfjsRoot, 'build', 'pdf.worker.min.mjs'),
];

function parseVersion(value) {
  return String(value)
    .replace(/^v/i, '')
    .split('.')
    .slice(0, 3)
    .map((part) => Number.parseInt(part, 10) || 0);
}

function compareVersions(left, right) {
  for (let index = 0; index < 3; index += 1) {
    if (left[index] > right[index]) return 1;
    if (left[index] < right[index]) return -1;
  }
  return 0;
}

function remove(target) {
  if (!fs.existsSync(target)) return;
  console.log(`Removing ${path.relative(projectRoot, target) || target}...`);
  fs.rmSync(target, { recursive: true, force: true, maxRetries: 5, retryDelay: 250 });
}

function runNpm(argumentsList) {
  console.log(`\n> npm ${argumentsList.join(' ')}\n`);

  const npmCli = process.env.npm_execpath;
  const command = npmCli ? process.execPath : process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const commandArguments = npmCli ? [npmCli, ...argumentsList] : argumentsList;
  const result = spawnSync(command, commandArguments, {
    cwd: projectRoot,
    env: process.env,
    stdio: 'inherit',
    shell: !npmCli && process.platform === 'win32',
  });

  if (result.error) {
    console.error(`Unable to start npm: ${result.error.message}`);
    return false;
  }
  return result.status === 0;
}

function packageIsComplete() {
  if (!requiredFiles.every((filePath) => fs.existsSync(filePath))) return false;

  try {
    const packageData = JSON.parse(
      fs.readFileSync(path.join(pdfjsRoot, 'package.json'), 'utf8'),
    );
    return packageData.version === PDFJS_VERSION
      && fs.statSync(path.join(pdfjsRoot, 'build', 'pdf.mjs')).size > 100_000
      && fs.statSync(path.join(pdfjsRoot, 'build', 'pdf.worker.min.mjs')).size > 100_000;
  } catch {
    return false;
  }
}

const currentNode = parseVersion(process.versions.node);
if (compareVersions(currentNode, MINIMUM_NODE) < 0) {
  console.error(
    `Node.js ${MINIMUM_NODE.join('.')} or newer is required. Current version: ${process.versions.node}.`,
  );
  console.error('Install a current Node.js LTS release, reopen PowerShell, then run this command again.');
  process.exit(1);
}

console.log(`Project: ${projectRoot}`);
console.log(`Node.js: ${process.versions.node}`);
console.log(`Repairing pdfjs-dist ${PDFJS_VERSION}...`);

remove(pdfjsRoot);
remove(path.join(nodeModules, '.vite'));
remove(path.join(nodeModules, '.vite-temp'));
remove(path.join(nodeModules, '.package-lock.json'));

const targetedInstallSucceeded = runNpm([
  'install',
  '--save-exact',
  '--include=optional',
  `pdfjs-dist@${PDFJS_VERSION}`,
]);

if (!targetedInstallSucceeded || !packageIsComplete()) {
  console.warn('\nThe targeted repair did not restore every required PDF.js file.');
  console.warn('A full dependency reinstall will now be performed.\n');
  remove(nodeModules);

  if (!runNpm(['install', '--include=optional'])) {
    console.error('\nThe full npm install failed. Review the npm error above.');
    process.exit(1);
  }
}

if (!packageIsComplete()) {
  console.error('\npdfjs-dist is still incomplete after reinstalling dependencies.');
  console.error('Temporarily pause antivirus/quarantine scanning for this project folder, then run the repair again.');
  process.exit(1);
}

console.log('\nPDF.js dependency repair completed successfully.');
console.log('Next command: npm run build');
