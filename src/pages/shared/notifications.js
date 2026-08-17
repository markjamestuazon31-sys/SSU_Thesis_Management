import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead
} from '../../services/notification.service.js';
import { pageHeader, emptyState } from '../../components/ui.js';
import { icon } from '../../components/icons.js';
import { escapeHtml } from '../../utils/dom.js';
import { relativeTime } from '../../utils/date.js';
import { toast } from '../../components/toast.js';
import '../../styles/notifications-v71.css';

function notificationVisual(item = {}) {
  const haystack = `${item.type || ''} ${item.title || ''} ${item.message || ''}`.toLowerCase();

  if (haystack.includes('publish')) {
    return { icon: 'repository', tone: 'published', label: 'Publication' };
  }

  if (haystack.includes('approve') || haystack.includes('approval')) {
    return { icon: 'check', tone: 'approval', label: 'Approval' };
  }

  if (haystack.includes('revision') || haystack.includes('review')) {
    return { icon: 'review', tone: 'review', label: 'Review' };
  }

  if (haystack.includes('assign') || haystack.includes('adviser')) {
    return { icon: 'users', tone: 'assignment', label: 'Assignment' };
  }

  return { icon: 'bell', tone: 'info', label: 'Notification' };
}

function notificationCard(item) {
  const visual = notificationVisual(item);
  const route = item.route || '/dashboard';

  return `
    <article
      class="notification-card ${item.read ? 'is-read' : 'is-unread'}"
      data-status="${item.read ? 'read' : 'unread'}"
      data-id="${escapeHtml(item.id)}"
    >
      <a class="notification-card-main" href="#${escapeHtml(route)}" data-notification-link>
        <span class="notification-card-icon tone-${visual.tone}">
          ${icon(visual.icon, 21)}
        </span>

        <div class="notification-card-content">
          <div class="notification-card-meta">
            <span class="notification-type">${escapeHtml(visual.label)}</span>
            ${item.read
              ? '<span class="notification-state">Read</span>'
              : '<span class="notification-state unread-state"><i></i> New</span>'}
          </div>

          <h3>${escapeHtml(item.title || 'Notification')}</h3>
          <p>${escapeHtml(item.message || '')}</p>

          <div class="notification-card-footer">
            <span>${icon('clock', 14)} ${escapeHtml(relativeTime(item.createdAt))}</span>
            <strong>Open details ${icon('arrow', 14)}</strong>
          </div>
        </div>
      </a>
    </article>`;
}

export async function render({ profile }) {
  const items = await getNotifications(profile.uid);
  const unread = items.filter((item) => !item.read).length;
  const read = items.length - unread;

  const actions = unread
    ? '<button class="btn btn-secondary notification-mark-all" id="mark-all" type="button">Mark all as read</button>'
    : '';

  return `
    <div class="notification-page">
      ${pageHeader(
        'Notifications',
        'Stay updated on thesis reviews, adviser decisions, final approvals, and repository publication.',
        actions
      )}

      <section class="notification-summary-grid" aria-label="Notification summary">
        <article class="notification-summary-card">
          <span class="notification-summary-icon">${icon('bell', 21)}</span>
          <div>
            <span>All notifications</span>
            <strong>${items.length}</strong>
          </div>
        </article>

        <article class="notification-summary-card unread-summary">
          <span class="notification-summary-icon">${icon('bell', 21)}</span>
          <div>
            <span>Unread</span>
            <strong>${unread}</strong>
          </div>
        </article>

        <article class="notification-summary-card">
          <span class="notification-summary-icon">${icon('check', 21)}</span>
          <div>
            <span>Read</span>
            <strong>${read}</strong>
          </div>
        </article>
      </section>

      <section class="notification-workspace">
        <div class="notification-workspace-head">
          <div>
            <p class="eyebrow">Activity Center</p>
            <h2>Recent alerts</h2>
            <span id="notification-visible-count">${items.length} notification${items.length === 1 ? '' : 's'}</span>
          </div>

          <div class="notification-filter-tabs" role="tablist" aria-label="Filter notifications">
            <button class="active" type="button" data-filter="all">All</button>
            <button type="button" data-filter="unread">Unread</button>
            <button type="button" data-filter="read">Read</button>
          </div>
        </div>

        <div class="notification-card-list" id="notification-list">
          ${items.length
            ? items.map(notificationCard).join('')
            : emptyState(
                'No notifications yet',
                'Workflow alerts, review decisions, and publication updates will appear here.'
              )}
        </div>

        <div class="notification-filter-empty" id="notification-filter-empty" hidden>
          ${icon('bell', 28)}
          <h3>No notifications in this view</h3>
          <p>Choose another filter to view your notification history.</p>
        </div>
      </section>
    </div>`;
}

export function mount({ profile }) {
  const markAllButton = document.getElementById('mark-all');
  const filterButtons = [...document.querySelectorAll('.notification-filter-tabs button')];
  const cards = [...document.querySelectorAll('.notification-card')];
  const visibleCount = document.getElementById('notification-visible-count');
  const filterEmpty = document.getElementById('notification-filter-empty');

  markAllButton?.addEventListener('click', async () => {
    markAllButton.disabled = true;
    const original = markAllButton.textContent;
    markAllButton.textContent = 'Updating...';

    try {
      await markAllNotificationsRead(profile.uid);
      toast('All notifications marked as read.', 'success');
      location.hash = `#/notifications?refresh=${Date.now()}`;
    } catch (error) {
      toast(error.message || 'Unable to update notifications.', 'error');
      markAllButton.disabled = false;
      markAllButton.textContent = original;
    }
  });

  document.querySelectorAll('[data-notification-link]').forEach((link) => {
    link.addEventListener('click', () => {
      const card = link.closest('.notification-card');
      if (!card?.dataset.id || card.dataset.status === 'read') return;

      markNotificationRead(profile.uid, card.dataset.id).catch(() => {});
    });
  });

  const applyFilter = (filter) => {
    let visible = 0;

    cards.forEach((card) => {
      const show = filter === 'all' || card.dataset.status === filter;
      card.hidden = !show;
      if (show) visible += 1;
    });

    filterButtons.forEach((button) => {
      button.classList.toggle('active', button.dataset.filter === filter);
    });

    if (visibleCount) {
      visibleCount.textContent = `${visible} notification${visible === 1 ? '' : 's'}`;
    }

    if (filterEmpty) {
      filterEmpty.hidden = visible !== 0 || cards.length === 0;
    }
  };

  filterButtons.forEach((button) => {
    button.addEventListener('click', () => applyFilter(button.dataset.filter || 'all'));
  });
}
