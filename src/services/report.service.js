import { getAllTheses } from './thesis.service.js';
import { getAllUsers } from './user.service.js';

export async function getReportData() {
  const [theses, users] = await Promise.all([getAllTheses(), getAllUsers()]);
  const statuses = {};
  const programs = {};
  const roles = {};
  const years = {};

  for (const thesis of theses) {
    statuses[thesis.status] = (statuses[thesis.status] || 0) + 1;
    const program = thesis.program || 'Unspecified';
    programs[program] = (programs[program] || 0) + 1;
    const year = String(thesis.year || 'Unspecified');
    years[year] = (years[year] || 0) + 1;
  }

  for (const user of users) roles[user.role || 'unknown'] = (roles[user.role || 'unknown'] || 0) + 1;

  const activeWorkflow = theses.filter((thesis) => !['published', 'archived', 'rejected'].includes(thesis.status)).length;
  const published = statuses.published || 0;
  const publicationRate = theses.length ? Math.round((published / theses.length) * 100) : 0;

  return { theses, users, statuses, programs, roles, years, activeWorkflow, published, publicationRate };
}
