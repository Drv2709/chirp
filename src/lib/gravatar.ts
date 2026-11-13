import crypto from "node:crypto";

// Gravatar identifies avatars by a hash of the trimmed, lowercased email.
// MD5 is used here only because Gravatar requires it; it is not a security measure.
// `d=identicon` gives every user a generated avatar when they have no Gravatar account.
export function gravatarUrl(email: string, size = 96): string {
  const hash = crypto.createHash("md5").update(email.trim().toLowerCase()).digest("hex");
  return `https://www.gravatar.com/avatar/${hash}?s=${size}&d=identicon`;
}