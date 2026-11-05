import "express-session";

declare global {
  namespace Express {
    // What passport attaches to req.user. Never includes passwordHash.
    interface User {
      id: string;
      username: string;
      displayName: string;
    }
  }
}

declare module "express-session" {
  interface SessionData {
    csrfToken?: string;
  }
}

export {};