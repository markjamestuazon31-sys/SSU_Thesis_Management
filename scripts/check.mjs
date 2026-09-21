import fs from 'node:fs';
import assert from 'node:assert/strict';
import {
  normalizeResearchTitle,
  researchRegistrationKey,
  validResearchYear,
} from '../src/utils/validation.js';
import { filterTheses, sortForResearchInstructorReview } from '../src/utils/thesis-filter.js';
import { APP_CONFIG, CAS_PROGRAMS } from '../src/config/app.config.js';

const read = (relativePath) => fs.readFileSync(new URL(relativePath, import.meta.url), 'utf8');
const rules = JSON.parse(read('../database.rules.json')).rules || {};
const reviewSource = read('../src/pages/adviser/review.js');
const studentSubmitSource = read('../src/pages/student/submit.js');
const studentDetailSource = read('../src/pages/student/thesis-detail.js');
const registerSource = read('../src/pages/public/register.js');
const reviewServiceSource = read('../src/services/review.service.js');
const thesisServiceSource = read('../src/services/thesis.service.js');
const chairRecordsSource = read('../src/pages/program-chair/records.js');
const chairDetailSource = read('../src/pages/program-chair/detail.js');
const fileServiceSource = read('../src/services/file.service.js');
const packageData = JSON.parse(read('../package.json'));

const requiredIndexes = {
  theses: ['ownerUid', 'researchInstructorUid', 'adviserUid', 'program', 'programChairUid', 'status'],
  researchInstructorDirectory: ['program', 'status'],
  programChairDirectory: ['program', 'status'],
  isoEvaluations: ['uid'],
};
for (const [path, expected] of Object.entries(requiredIndexes)) {
  const value = rules[path]?.['.indexOn'];
  const actual = Array.isArray(value) ? value : value ? [value] : [];
  const missing = expected.filter((key) => !actual.includes(key));
  assert.equal(missing.length, 0, `Missing .indexOn at /${path}: ${missing.join(', ')}`);
}
console.log('Required Firebase Realtime Database indexes are present.');

assert.equal(rules['.read'], true, 'TEST ONLY rules must currently permit reads for testing.');
assert.equal(rules['.write'], true, 'TEST ONLY rules must currently permit writes for testing.');
console.log('TEST ONLY Firebase rules are intentionally permissive. Do not deploy these rules to production.');

const normalizedA = normalizeResearchTitle('  Digital   Literacy — Among Students  ');
const normalizedB = normalizeResearchTitle('digital literacy - among students');
assert.equal(normalizedA, normalizedB, 'Equivalent research titles must normalize identically.');
assert.equal(researchRegistrationKey(normalizedA), researchRegistrationKey(normalizedB));
assert.doesNotMatch(researchRegistrationKey(normalizedA), /[.#$\[\]/]/, 'Research registration keys must be Firebase-safe.');
assert.equal(validResearchYear(String(new Date().getFullYear())), String(new Date().getFullYear()));
console.log('Research title/year validation checks passed.');

const program = CAS_PROGRAMS[1];
const filterFixture = [
  { id: 'a', title: 'Coastal Study', studentName: 'Ana', program, year: 2026, status: 'under_review', researchInstructorUid: 'ri-1', updatedAt: 10 },
  { id: 'b', title: 'Learning System', studentName: 'Ben', program, year: 2025, status: 'published', researchInstructorUid: 'ri-2', updatedAt: 20 },
  { id: 'c', title: 'Community Archive', studentName: 'Cara', program, year: 2026, status: 'revision_required', researchInstructorUid: 'ri-1', updatedAt: 30 },
];
assert.deepEqual(filterTheses(filterFixture, { program, year: '2026' }).map((item) => item.id), ['a', 'c']);
assert.deepEqual(filterTheses(filterFixture, { search: 'ben', status: 'published' }).map((item) => item.id), ['b']);
assert.deepEqual(filterTheses(filterFixture, { adviser: 'ri-1', priority: 'needs_review' }).map((item) => item.id), ['a']);
assert.deepEqual(sortForResearchInstructorReview(filterFixture).map((item) => item.id), ['a', 'c', 'b']);
console.log('Research Instructor and administrator filtering checks passed.');

assert.match(registerSource, /researchInstructorUid/, 'Student registration must save a Research Instructor selection.');
assert.match(registerSource, /program/, 'Student registration must use the selected program when filtering instructors.');
assert.doesNotMatch(studentSubmitSource, /name=["']adviserUid["']|name=["']researchInstructorUid["']/, 'Thesis submission must not ask the student to reselect the Research Instructor.');
assert.match(studentSubmitSource, /Assigned Research Instructor/i);
console.log('Student account and submission routing checks passed.');

assert.doesNotMatch(reviewSource, /annotation-workspace|Circle|Freehand|pdfjs-dist|docx-preview|html2canvas/i);
assert.match(reviewSource, /Download Original/i);
assert.match(reviewSource, /Review outside the website/i);
assert.match(reviewSource, /Save & Continue Later/i);
assert.match(reviewSource, /Program Chair monitoring/i);
assert.match(studentDetailSource, /Download Reviewed Copy/i);
assert.match(studentDetailSource, /Submit Version/i);
console.log('External Research Instructor review and student revision workflow checks passed.');

assert.match(reviewServiceSource, /researchInstructorUid/, 'Reviews must identify the Research Instructor.');
assert.match(reviewServiceSource, /programChairMonitoringAt/, 'Instructor approval must route to Program Chair monitoring.');
assert.match(reviewServiceSource, /getProgramChairForProgram/, 'Program Chair must be resolved from the thesis program.');
assert.match(reviewServiceSource, /instructor_approved/, 'New final instructor decision status is required.');
assert.match(reviewServiceSource, /reviewDrafts\//, 'Review drafts must be persisted.');
assert.match(reviewServiceSource, /reviewedFileId/, 'Revision reviews must preserve the reviewed file.');
assert.match(reviewServiceSource, /sourceVersion/, 'Reviews must link to the exact student manuscript version.');
assert.match(thesisServiceSource, /researchInstructorUid/, 'Thesis records must save the Research Instructor.');
assert.match(thesisServiceSource, /programChairUid/, 'Thesis records must support Program Chair routing.');
console.log('Research Instructor → Program Chair → Admin workflow checks passed.');

assert.match(chairRecordsSource, /getProgramChairTheses/, 'Program Chair list must be program-scoped.');
assert.match(chairRecordsSource, /Monitoring only|monitoring only/i, 'Program Chair UI must state monitoring-only authority.');
assert.doesNotMatch(chairDetailSource, /approveAndPublishThesis|submitReview|request revision/i, 'Program Chair detail must not expose approval/revision actions.');
console.log('Program Chair read-only monitoring checks passed.');

assert.match(fileServiceSource, /getKeyRange/, 'Large Realtime Database files must download in bounded chunk ranges.');
for (const removedDependency of ['pdfjs-dist', 'docx-preview', 'html2canvas']) {
  assert.ok(!packageData.dependencies?.[removedDependency], `${removedDependency} should not be required by the external-review build.`);
}
assert.ok(packageData.dependencies?.firebase, 'Firebase dependency is required.');
assert.equal(APP_CONFIG.maxFileSizeBytes, 100 * 1024 * 1024, 'The manuscript upload limit must remain 100 MB.');
const encodedChunkLength = Math.ceil(APP_CONFIG.fileChunkBytes / 3) * 4;
assert.ok(encodedChunkLength <= 200000, 'A base64 manuscript chunk must fit the Realtime Database chunk size.');
console.log('File workflow and 100 MB manuscript checks passed.');
