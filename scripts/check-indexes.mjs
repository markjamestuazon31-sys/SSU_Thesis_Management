import fs from 'node:fs';
import assert from 'node:assert/strict';

const rules = JSON.parse(fs.readFileSync(new URL('../database.rules.json', import.meta.url), 'utf8')).rules || {};
const required = {
  theses: ['ownerUid', 'adviserUid', 'status'],
  isoEvaluations: ['uid'],
};

for (const [path, expected] of Object.entries(required)) {
  const value = rules[path]?.['.indexOn'];
  const actual = Array.isArray(value) ? value : value ? [value] : [];
  const missing = expected.filter((key) => !actual.includes(key));
  assert.equal(missing.length, 0, `Missing .indexOn at /${path}: ${missing.join(', ')}`);
  console.log(`/${path}: ${expected.join(', ')} OK`);
}
