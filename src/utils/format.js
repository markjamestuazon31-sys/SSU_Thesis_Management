export const titleCase = (value='') => String(value).replaceAll('_',' ').replace(/\b\w/g,(c)=>c.toUpperCase());
export function formatBytes(bytes=0) { if (!Number.isFinite(bytes)||bytes<=0) return '0 B'; const u=['B','KB','MB','GB']; const i=Math.min(Math.floor(Math.log(bytes)/Math.log(1024)),u.length-1); return `${(bytes/1024**i).toFixed(i?1:0)} ${u[i]}`; }
export function csvEscape(value) { return `"${String(value ?? '').replaceAll('"','""')}"`; }
