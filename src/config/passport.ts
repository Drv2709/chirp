import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { prisma } from "../lib/prisma";
import { DUMMY_HASH, verifyPassword } from "../lib/password";

export function configurePassport(): void {
  passport.use(
    new LocalStrategy(
      { usernameField: "username", passwordField: "password" },
      async (username, password, done) => {
        try {
          const user = await prisma.user.findUnique({
            where: { username: username.toLowerCase() },
            select: {
              id: true,
              username: true,
              displayName: true,
              passwordHash: true,
            },
          });

          // Always run one bcrypt comparison, whether or not the user exists.
          const passwordOk = await verifyPassword(
            password,
            user?.passwordHash ?? DUMMY_HASH,
          );

          if (!user || !passwordOk) {
            done(null, false);
            return;
          }

          // passwordHash is deliberately not passed on.
          done(null, {
            id: user.id,
            username: user.username,
            displayName: user.displayName,
          });
        } catch (error) {
          done(error);
        }
      },
    ),
  );

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id },
        select: { id: true, username: true, displayName: true },
      });
      done(null, user ?? false);
    } catch (error) {
      done(error);
    }
  });
}
