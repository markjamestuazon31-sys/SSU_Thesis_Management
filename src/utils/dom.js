export const qs = (selector, root = document) => root.querySelector(selector);
export const qsa = (selector, root = document) => [...root.querySelectorAll(selector)];
export function escapeHtml(value = '') { return String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;'); }
export function setButtonLoading(button, loading, label = 'Please wait...') {
  if (!button) return;
  if (loading) { button.dataset.original = button.innerHTML; button.disabled = true; button.innerHTML = `<span class="button-spinner"></span>${label}`; }
  else { button.disabled = false; button.innerHTML = button.dataset.original || button.innerHTML; }
}
export function formDataObject(form) { return Object.fromEntries(new FormData(form).entries()); }
