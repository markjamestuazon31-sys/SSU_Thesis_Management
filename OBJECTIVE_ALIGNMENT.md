# SSU CAS Thesis Record Management System — Objective Alignment

## General Objective
Develop a Thesis Record Management System for all CAS programs that improves the storage, retrieval, and management of thesis records.

## Objective 1 — Submission, upload, storage, and metadata
Implemented through the Student `New Thesis Submission` module.

- Web-based thesis record submission
- Research title, author/researchers, abstract, keywords, program, department, adviser, research year, and academic year metadata
- PDF/DOCX validation before upload
- Maximum manuscript size: 10 MB
- Manuscript files are split into Base64 chunks and stored under `fileChunks/{fileId}` in Firebase Realtime Database
- File metadata is stored under `files/{fileId}`
- Submission/version records are stored under `submissions/{thesisId}`
- **Firebase Storage is not used**

## Objective 2 — Centralized repository, search, and retrieval
Implemented through the public and authenticated SSU Research Repository.

- Approved/published records are projected to `publishedTheses/{thesisId}`
- Public repository is the first page of the website
- Search supports title, author, student name, program, keywords, and year
- Published research is also shown inside Student, Adviser, and Admin dashboards
- Full manuscript retrieval requires an authenticated active account

## Objective 3 — Admin panel and role-based workflow
Implemented through Firebase Authentication + Realtime Database profiles and role-protected routes.

- Student: self-registration, submission, revision, status tracking
- Adviser: account created by administrator, assigned thesis review, revision request, recommendation/rejection
- Administrator: permanent primary administrator, adviser account creation, adviser assignment, user management, approval, publication, archive, reports, and system settings
- Workflow: Student → Adviser → Administrator → Repository
- Realtime Database security rules restrict access by role and record ownership/assignment

## Objective 4 — Automated dashboards, statistics, and realtime monitoring
Implemented through live Firebase Realtime Database listeners.

- Role-specific dashboard metrics
- Live workflow stage counts
- Live unread notification count
- Live published repository count and records
- Admin Reports & Analytics page with workflow, program, year, role, and publication statistics
- CSV report export
- Automatic refresh through `onValue()` listeners without manually reloading the page

## Firebase Architecture
This project uses only:

1. Firebase Authentication — account authentication
2. Firebase Realtime Database — users, thesis metadata, workflow, reviews, notifications, reports, audit records, published records, file metadata, and manuscript chunks

It does **not** initialize, import, configure, or use Firebase Storage.
