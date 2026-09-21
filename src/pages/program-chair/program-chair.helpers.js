import { STATUS_LABELS } from '../../config/app.config.js';

export const CHAIR_ROUTED_STATUSES = Object.freeze([
  'instructor_approved',
  'adviser_approved',
  'recommended',
  'approved',
  'published',
  'archived',
]);

const routedStatusSet = new Set(CHAIR_ROUTED_STATUSES);

export function isProgramChairRouted(thesis = {}) {
  return Boolean(
    thesis.programChairMonitoringAt ||
    thesis.researchInstructorApprovedAt ||
    thesis.adviserApprovedAt ||
    routedStatusSet.has(thesis.status)
  );
}

export function getProgramChairVisibleRows(rows = []) {
  return rows.filter(isProgramChairRouted);
}

export function isAwaitingAdmin(thesis = {}) {
  return ['instructor_approved', 'adviser_approved', 'recommended'].includes(thesis.status);
}

export function isPublished(thesis = {}) {
  return thesis.status === 'published';
}

export function isArchived(thesis = {}) {
  return thesis.status === 'archived';
}

export function statusLabel(status = '') {
  return STATUS_LABELS[status] || String(status || 'Unknown').replaceAll('_', ' ');
}

export function progressStage(thesis = {}) {
  if (thesis.status === 'published') return 5;
  if (thesis.status === 'approved') return 4;
  if (thesis.status === 'archived') {
    const previous = thesis.previousStatus;
    if (previous === 'published') return 5;
    if (previous === 'approved') return 4;
    return 3;
  }
  return 3;
}

export function groupCounts(rows = [], getter) {
  const result = new Map();
  rows.forEach((row) => {
    const key = String(getter(row) || 'Not specified');
    result.set(key, (result.get(key) || 0) + 1);
  });
  return [...result.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}
