import fs from 'node:fs';
import assert from 'node:assert/strict';
import {
  normalizeResearchTitle,
  researchRegistrationKey,
  validResearchYear,
} from '../src/utils/validation.js';
import { filterTheses, sortForAdviserReview } from '../src/utils/thesis-filter.js';
import { APP_CONFIG } from '../src/config/app.config.js';

const read = (relativePath) => fs.readFileSync(new URL(relativePath, import.meta.url), 'utf8');
const rules = JSON.parse(read('../database.rules.json')).rules || {};
const adviserReviewSource = read('../src/pages/adviser/review.js');
const studentDetailSource = read('../src/pages/student/thesis-detail.js');
const reviewServiceSource = read('../src/services/review.service.js');
const fileServiceSource = read('../src/services/file.service.js');
const packageData = JSON.parse(read('../package.json'));

const requiredIndexes = {
  theses: ['ownerUid', 'adviserUid', 'status'],
  isoEvaluations: ['uid'],
};

for (const [path, expected] of Object.entries(requiredIndexes)) {
  const indexOn = rules[path]?.['.indexOn'];
  const actual = Array.isArray(indexOn) ? indexOn : indexOn ? [indexOn] : [];
  const missing = expected.filter((key) => !actual.includes(key));
  assert.equal(missing.length, 0, `Missing .indexOn at /${path}: ${missing.join(', ')}`);
  console.log(`/${path}: indexes OK (${expected.join(', ')})`);
}
console.log('Required Firebase Realtime Database indexes are present.');

assert.ok(rules.researchRegistrationClaims?.$year?.$registrationKey, 'Missing atomic research registration claim rules.');
assert.match(
  rules.users?.$uid?.['.write'] || '',
  /researchRegistrationClaims/,
  'Student profile creation must require a matching research registration claim.',
);

const normalizedA = normalizeResearchTitle('  Digital   Literacy — Among Students  ');
const normalizedB = normalizeResearchTitle('digital literacy - among students');
assert.equal(normalizedA, normalizedB, 'Equivalent research titles must normalize identically.');
assert.equal(researchRegistrationKey(normalizedA), researchRegistrationKey(normalizedB));
assert.doesNotMatch(researchRegistrationKey(normalizedA), /[.#$\[\]/]/, 'Research registration keys must be Firebase-safe.');
assert.equal(validResearchYear(String(new Date().getFullYear())), String(new Date().getFullYear()));
console.log('Research title/year validation and duplicate-registration protection checks passed.');

const filterFixture = [
  { id: 'a', title: 'Coastal Study', studentName: 'Ana', program: 'BS Statistics', year: 2026, status: 'under_review', adviserUid: 'adv-1', updatedAt: 10 },
  { id: 'b', title: 'Learning System', studentName: 'Ben', program: 'BS Information Technology', year: 2025, status: 'published', adviserUid: 'adv-2', updatedAt: 20 },
  { id: 'c', title: 'Community Archive', studentName: 'Cara', program: 'BS Statistics', year: 2026, status: 'revision_required', adviserUid: 'adv-1', updatedAt: 30 },
];
assert.deepEqual(filterTheses(filterFixture, { program: 'BS Statistics', year: '2026' }).map((item) => item.id), ['a', 'c']);
assert.deepEqual(filterTheses(filterFixture, { search: 'ben', status: 'published' }).map((item) => item.id), ['b']);
assert.deepEqual(filterTheses(filterFixture, { adviser: 'adv-1', priority: 'needs_review' }).map((item) => item.id), ['a']);
assert.deepEqual(sortForAdviserReview(filterFixture).map((item) => item.id), ['a', 'c', 'b']);
console.log('Adviser and administrator thesis filtering checks passed.');

// External review workflow: the website must download the exact student file,
// not render or annotate PDF/DOCX pages in the browser.
assert.doesNotMatch(adviserReviewSource, /annotation-workspace|Circle|Freehand|pdfjs-dist|docx-preview|html2canvas/i);
assert.match(adviserReviewSource, /Download Original/i);
assert.match(adviserReviewSource, /Review outside the website/i);
assert.match(adviserReviewSource, /Save & Continue Later/i);
assert.match(adviserReviewSource, /Upload reviewed manuscript|Replace reviewed manuscript/i);
assert.match(studentDetailSource, /Download Reviewed Copy/i);
assert.match(studentDetailSource, /Submit Version/i);
console.log('External adviser review and student revision workflow checks passed.');

assert.match(reviewServiceSource, /reviewDrafts\//, 'Adviser draft reviews must be persisted.');
assert.match(reviewServiceSource, /reviewedFileId/, 'Revision reviews must preserve the adviser-reviewed file.');
assert.match(reviewServiceSource, /sourceVersion/, 'Reviews must be linked to the exact student manuscript version.');
assert.match(reviewServiceSource, /updateRoot\(updates\)/, 'Final review and thesis status must use a multi-location update.');
assert.match(reviewServiceSource, /adviser_reviewed_manuscript/, 'Reviewed copies must be identified separately from student manuscripts.');
assert.match(fileServiceSource, /getKeyRange/, 'Large Realtime Database files must download in bounded chunk ranges.');

const reviewValidation = rules.reviews?.$thesisId?.$reviewId?.['.validate'] || '';
assert.match(reviewValidation, /reviewedFileId/, 'Review rules must validate the returned reviewed manuscript.');
assert.match(reviewValidation, /revisionLevel/, 'Review rules must validate minor/major revision level.');
assert.match(reviewValidation, /sourceVersion/, 'Review rules must validate the source manuscript version.');
assert.ok(rules.reviewDrafts?.$thesisId, 'Missing adviser review draft rules.');
assert.match(rules.files?.$fileId?.['.read'] || '', /ownerUid.*auth\.uid/, 'Thesis participants must be able to read permitted files.');
assert.match(rules.files?.$fileId?.['.write'] || '', /adviser_reviewed_manuscript/, 'Assigned advisers must be allowed to upload reviewed copies.');
console.log('Reviewed-file, version-linking, draft, and security-rule checks passed.');

for (const removedDependency of ['pdfjs-dist', 'docx-preview', 'html2canvas']) {
  assert.ok(!packageData.dependencies?.[removedDependency], `${removedDependency} should not be required by the external-review build.`);
}
assert.ok(packageData.dependencies?.firebase, 'Firebase dependency is required.');
console.log('Browser manuscript-rendering dependencies were removed from the active build.');

assert.equal(APP_CONFIG.maxFileSizeBytes, 100 * 1024 * 1024, 'The manuscript upload limit must remain 100 MB.');
assert.match(rules.files?.$fileId?.['.validate'] || '', /104857600/, 'Realtime Database rules must allow manuscript metadata up to 100 MB.');
const encodedChunkLength = Math.ceil(APP_CONFIG.fileChunkBytes / 3) * 4;
assert.ok(encodedChunkLength <= 200000, 'A base64 manuscript chunk must fit the Realtime Database chunk rule.');
console.log('100 MB Realtime Database manuscript limit and chunk-size checks passed.');
