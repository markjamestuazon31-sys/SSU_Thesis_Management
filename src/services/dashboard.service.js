import { getNotifications } from './notification.service.js';
import {
  getAllTheses,
  getAssignedTheses,
  getMyTheses,
  getProgramChairTheses,
  getPublishedTheses,
} from './thesis.service.js';
import { getAllUsers, isResearchInstructorRole } from './user.service.js';

const count = (items, status) => items.filter((item) => item.status === status).length;
const instructorApproved = (item) => ['instructor_approved', 'adviser_approved', 'recommended'].includes(item.status);
const visibleToChair = (item) => Boolean(
  item.researchInstructorApprovedAt ||
  item.adviserApprovedAt ||
  item.programChairMonitoringAt ||
  ['instructor_approved', 'adviser_approved', 'recommended', 'approved', 'published', 'archived'].includes(item.status)
);

export async function getDashboardData(profile) {
  const notificationsPromise = getNotifications(profile.uid).catch(() => []);
  const publishedPromise = getPublishedTheses().catch((error) => {
    console.error('Unable to load published research for dashboard:', error);
    return [];
  });

  if (profile.role === 'student') {
    const [notifications, theses, published] = await Promise.all([
      notificationsPromise,
      getMyTheses(profile.uid),
      publishedPromise,
    ]);

    return {
      stats: [
        { label: 'My Thesis Records', value: String(theses.length), iconName: 'file' },
        { label: 'Awaiting Review', value: String(theses.filter((item) => ['submitted', 'under_review'].includes(item.status)).length), iconName: 'clock' },
        { label: 'Revision Required', value: String(count(theses, 'revision_required')), iconName: 'review' },
        { label: 'Published Research', value: String(published.length), iconName: 'repository' },
      ],
      theses,
      recent: theses.slice(0, 5),
      published,
      unread: notifications.filter((item) => !item.read).length,
    };
  }

  if (isResearchInstructorRole(profile.role)) {
    const [notifications, theses, published] = await Promise.all([
      notificationsPromise,
      getAssignedTheses(profile.uid),
      publishedPromise,
    ]);

    return {
      stats: [
        { label: 'Assigned Thesis Records', value: String(theses.length), iconName: 'file' },
        { label: 'For Review', value: String(theses.filter((item) => ['submitted', 'under_review'].includes(item.status)).length), iconName: 'review' },
        { label: 'Revision Cycle', value: String(count(theses, 'revision_required')), iconName: 'clock' },
        { label: 'Instructor Approved', value: String(theses.filter(instructorApproved).length), iconName: 'check' },
      ],
      theses,
      recent: theses.slice(0, 5),
      published,
      unread: notifications.filter((item) => !item.read).length,
    };
  }

  if (profile.role === 'program_chair') {
    const [notifications, allProgramTheses, published] = await Promise.all([
      notificationsPromise,
      getProgramChairTheses(profile.program || ''),
      publishedPromise,
    ]);
    const theses = allProgramTheses.filter(visibleToChair);
    const programPublished = published.filter((item) => item.program === profile.program);
    return {
      stats: [
        { label: 'Routed Research', value: String(theses.length), iconName: 'file', helper: 'Research Instructor-approved records' },
        { label: 'Awaiting Admin', value: String(theses.filter(instructorApproved).length), iconName: 'clock', helper: 'Final approval pending' },
        { label: 'Published Research', value: String(theses.filter((item) => item.status === 'published').length), iconName: 'repository', helper: 'Published program records' },
        { label: 'Archived Records', value: String(theses.filter((item) => item.status === 'archived').length), iconName: 'archive', helper: 'Retained program records' },
      ],
      theses,
      recent: theses.slice(0, 5),
      published: programPublished,
      unread: notifications.filter((item) => !item.read).length,
    };
  }

  const [notifications, theses, users, published] = await Promise.all([
    notificationsPromise,
    getAllTheses(),
    getAllUsers(),
    publishedPromise,
  ]);

  return {
    stats: [
      { label: 'Total Thesis Records', value: String(theses.length), iconName: 'file' },
      { label: 'Active Users', value: String(users.filter((item) => item.status === 'active').length), iconName: 'users' },
      { label: 'Awaiting Final Approval', value: String(theses.filter(instructorApproved).length), iconName: 'review' },
      { label: 'Uploaded Thesis', value: String(published.length), iconName: 'repository' },
    ],
    theses,
    recent: theses.slice(0, 5),
    published,
    unread: notifications.filter((item) => !item.read).length,
  };
}
