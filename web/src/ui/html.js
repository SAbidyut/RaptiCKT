// Text into HTML: what a user typed (a circuit's name, a folder, a label) goes into the page only
// through this, never raw.
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
