import { getNotifications } from './notification.service.js';
import { getAllTheses, getAssignedTheses, getMyTheses, getPublishedTheses } from './thesis.service.js';
import { getAllUsers } from './user.service.js';

const count = (items, status) => items.filter((item) => item.status === status).length;

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

  if (profile.role === 'adviser') {
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
        { label: 'Published Research', value: String(published.length), iconName: 'repository' },
      ],
      theses,
      recent: theses.slice(0, 5),
      published,
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
      { label: 'Awaiting Final Approval', value: String(theses.filter((item) => ['adviser_approved', 'recommended'].includes(item.status)).length), iconName: 'review' },
      { label: 'Published Research', value: String(published.length), iconName: 'repository' },
    ],
    theses,
    recent: theses.slice(0, 5),
    published,
    unread: notifications.filter((item) => !item.read).length,
  };
}
