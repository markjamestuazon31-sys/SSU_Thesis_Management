import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const EXPECTED_VERSION = '6.2.108';
const MINIMUM_NODE = [22, 13, 0];
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, '..');
const pdfjsRoot = path.join(projectRoot, 'node_modules', 'pdfjs-dist');

const requiredFiles = [
  ['package.json', 100],
  [path.join('build', 'pdf.mjs'), 100_000],
  [path.join('build', 'pdf.worker.min.mjs'), 100_000],
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

function fail(message, details = []) {
  console.error(`\n[PDF.js verification failed] ${message}`);
  for (const detail of details) console.error(`  - ${detail}`);
  console.error('\nRun this command from the project root:');
  console.error('  npm run repair:pdfjs\n');
  process.exit(1);
}

const currentNode = parseVersion(process.versions.node);
if (compareVersions(currentNode, MINIMUM_NODE) < 0) {
  fail(
    `Node.js ${MINIMUM_NODE.join('.')} or newer is required, but ${process.versions.node} is currently running.`,
    ['Install a current Node.js LTS release, reopen the terminal, and run the repair command again.'],
  );
}

const missingOrInvalid = [];
for (const [relativePath, minimumBytes] of requiredFiles) {
  const absolutePath = path.join(pdfjsRoot, relativePath);
  if (!fs.existsSync(absolutePath)) {
    missingOrInvalid.push(`${relativePath} is missing`);
    continue;
  }

  const size = fs.statSync(absolutePath).size;
  if (size < minimumBytes) {
    missingOrInvalid.push(`${relativePath} is incomplete (${size} bytes)`);
  }
}

if (missingOrInvalid.length) {
  fail('The installed pdfjs-dist package is incomplete.', missingOrInvalid);
}

let installedPackage;
try {
  installedPackage = JSON.parse(
    fs.readFileSync(path.join(pdfjsRoot, 'package.json'), 'utf8'),
  );
} catch (error) {
  fail('The installed pdfjs-dist package.json cannot be read.', [error.message]);
}

if (installedPackage.version !== EXPECTED_VERSION) {
  fail(
    `Expected pdfjs-dist ${EXPECTED_VERSION}, but found ${installedPackage.version || 'an unknown version'}.`,
  );
}

console.log(
  `PDF.js verification passed: pdfjs-dist ${installedPackage.version} with complete browser and worker entries.`,
);
