export const APP_CONFIG = Object.freeze({
  name: 'SSU Thesis Management System',
  shortName: 'SSU TMS',
  institution: 'Samar State University',
  unit: 'College of Arts and Sciences',
  version: '6.2.0',
  maxFileSizeBytes: 10 * 1024 * 1024,
  fileChunkBytes: 128 * 1024,
  acceptedExtensions: ['pdf', 'docx'],
});

export const CAS_PROGRAMS = Object.freeze([
  'Bachelor of Information System',
  'Bachelor of Information Technology',
  'Bachelor of Science in Psychology',
  'Bachelor of Science in Statistics',
]);

export const PRIMARY_ADMIN = Object.freeze({
  uid: 'B12ivUlc7VQXFYe9au49L3nHLNw2',
  email: 'admin@cas.com',
  displayName: 'CAS Thesis Administrator',
  department: 'Samar State University',
});

export const ROLES = Object.freeze({ STUDENT: 'student', ADVISER: 'adviser', ADMIN: 'admin' });

export const THESIS_STATUS = Object.freeze({
  SUBMITTED: 'submitted',
  UNDER_REVIEW: 'under_review',
  REVISION_REQUIRED: 'revision_required',
  ADVISER_APPROVED: 'adviser_approved',
  // Kept for compatibility with records created by older versions.
  RECOMMENDED: 'recommended',
  APPROVED: 'approved',
  PUBLISHED: 'published',
  REJECTED: 'rejected',
  ARCHIVED: 'archived',
});

export const STATUS_LABELS = Object.freeze({
  submitted: 'Submitted',
  under_review: 'Under Adviser Review',
  revision_required: 'Revision Required',
  adviser_approved: 'Adviser Approved',
  recommended: 'Awaiting Admin Approval',
  approved: 'Admin Approved',
  published: 'Published',
  rejected: 'Rejected',
  archived: 'Archived',
});
