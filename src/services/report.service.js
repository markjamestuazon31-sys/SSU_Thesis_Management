import { getAllTheses } from './thesis.service.js';
import { getAllUsers } from './user.service.js';

const ACTIVE_WORKFLOW_STATUSES = new Set([
  'submitted',
  'under_review',
  'revision_required',
  'adviser_approved',
  'recommended',
]);

export function summarizeTheses(theses = []) {
  const statuses = {};
  const programs = {};
  const years = {};

  for (const thesis of theses) {
    const status = thesis.status || 'unspecified';
    statuses[status] = (statuses[status] || 0) + 1;
    const program = thesis.program || 'Unspecified';
    programs[program] = (programs[program] || 0) + 1;
    const year = String(thesis.year || 'Unspecified');
    years[year] = (years[year] || 0) + 1;
  }

  const activeWorkflow = theses.filter((thesis) => ACTIVE_WORKFLOW_STATUSES.has(thesis.status)).length;
  const published = statuses.published || 0;
  const approved = statuses.approved || 0;
  const rejected = statuses.rejected || 0;
  const publicationRate = theses.length ? Math.round((published / theses.length) * 100) : 0;

  return { statuses, programs, years, activeWorkflow, published, approved, rejected, publicationRate };
}

export async function getReportData() {
  const [theses, users] = await Promise.all([getAllTheses(), getAllUsers()]);
  const roles = {};
  for (const user of users) roles[user.role || 'unknown'] = (roles[user.role || 'unknown'] || 0) + 1;

  return { theses, users, roles, ...summarizeTheses(theses) };
}
