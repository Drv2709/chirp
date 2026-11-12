// Only same-site absolute paths are allowed ("/", "/?page=2#post-abc").
// Rejects "//evil.com", "/\evil.com", full URLs, and anything with control characters.
export function safeReturnTo(value: unknown, fallback = "/"): string {
  if (typeof value !== "string" || value.length > 300) {
    return fallback;
  }
  return /^\/(?![/\\])[^\r\n\\]*$/.test(value) ? value : fallback;
}