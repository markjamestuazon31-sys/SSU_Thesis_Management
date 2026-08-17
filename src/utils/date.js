export function formatDate(value, options = {}) {
  if (!value) return '—'; const date = new Date(Number(value) || value); if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-PH', { year:'numeric', month:'short', day:'2-digit', ...options }).format(date);
}
export function formatDateTime(value) { return formatDate(value, { hour:'numeric', minute:'2-digit' }); }
export function relativeTime(value) {
  if (!value) return '—'; const ts = Number(value) || new Date(value).getTime(); const delta = ts - Date.now(); const abs = Math.abs(delta); const rtf = new Intl.RelativeTimeFormat('en',{numeric:'auto'});
  if (abs < 60000) return rtf.format(Math.round(delta/1000),'second'); if (abs < 3600000) return rtf.format(Math.round(delta/60000),'minute'); if (abs < 86400000) return rtf.format(Math.round(delta/3600000),'hour'); return rtf.format(Math.round(delta/86400000),'day');
}
