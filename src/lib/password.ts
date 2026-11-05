import bcrypt from "bcrypt";

// Cost >= 10 required; 12 is a good default for a web app.
export const BCRYPT_COST = 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// Compared against when a username doesn't exist, so response time
// doesn't reveal which usernames are registered.
export const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", BCRYPT_COST);
