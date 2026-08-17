import fs from 'node:fs';

const rulesPath = new URL('../database.rules.json', import.meta.url);
const parsed = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));
const rules = parsed.rules || {};

const required = {
  theses: ['ownerUid', 'adviserUid', 'status'],
  isoEvaluations: ['uid'],
};

let failed = false;
for (const [path, expected] of Object.entries(required)) {
  const indexOn = rules[path]?.['.indexOn'];
  const actual = Array.isArray(indexOn) ? indexOn : indexOn ? [indexOn] : [];
  const missing = expected.filter((key) => !actual.includes(key));
  if (missing.length) {
    failed = true;
    console.error(`Missing .indexOn at /${path}: ${missing.join(', ')}`);
  } else {
    console.log(`/${path}: indexes OK (${expected.join(', ')})`);
  }
}

if (failed) process.exit(1);
console.log('Required Firebase Realtime Database indexes are present in database.rules.json.');
