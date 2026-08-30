export function required(value,label) { const v=String(value ?? '').trim(); if (!v) throw new Error(`${label} is required.`); return v; }
export function validEmail(value) { const email=required(value,'Email address').toLowerCase(); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email address.'); return email; }
export function validPassword(value) { const p=String(value||''); if (p.length<8) throw new Error('Password must contain at least 8 characters.'); if (!/[A-Z]/.test(p)||!/[a-z]/.test(p)||!/[0-9]/.test(p)) throw new Error('Password must include uppercase, lowercase, and a number.'); return p; }

export function validResearchTitle(value) {
  const title = String(value ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim();
  if (!title) throw new Error('Research title is required.');
  if (title.length < 5) throw new Error('Research title must contain at least 5 characters.');
  if (title.length > 240) throw new Error('Research title must not exceed 240 characters.');
  if (new TextEncoder().encode(title).length > 480) {
    throw new Error('Research title is too long. Please shorten it and try again.');
  }
  return title;
}

export function normalizeResearchTitle(value) {
  return validResearchTitle(value)
    .toLowerCase()
    .replace(/[‘’´`]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[‐‑‒–—―]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

export function validResearchYear(value) {
  const raw = String(value ?? '').trim();
  const year = Number(raw);
  const latestAllowedYear = new Date().getFullYear() + 1;
  if (!/^\d{4}$/.test(raw) || !Number.isInteger(year) || year < 1900 || year > latestAllowedYear) {
    throw new Error(`Research year must be between 1900 and ${latestAllowedYear}.`);
  }
  return String(year);
}

/**
 * Firebase keys cannot contain several characters that are valid in research
 * titles. Base64url produces a deterministic, reversible, Firebase-safe key,
 * so an identical normalized title always competes for the same database path.
 */
export function researchRegistrationKey(normalizedTitle) {
  const bytes = new TextEncoder().encode(normalizedTitle);
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
