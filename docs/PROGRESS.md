## PHASE COMPLETE: P0 (Schema, Docker, config, skeleton, plan)

**Files created**

- prisma/schema.prisma, prisma/seed.js (placeholder), prisma/migrations/<timestamp>\_init_schema/
- docker-compose.yml (Postgres 16 on host port 5433), .env.example, .gitignore
- package.json, tsconfig.json
- docs/PLAN.md, docs/PROGRESS.md, public/styles.css (empty)
- Folder skeleton under src/, views/, public/

**Commands run**

- cp .env.example .env (SESSION_SECRET generated)
- npm install
- docker compose up -d
- npx prisma migrate dev --name init_schema
- npx prisma validate

**Verify checklist passed**

- [x] chirp-db healthy on localhost:5433
- [x] Migration folder exists; tables User, Post, Like, Comment, Follow, session created
- [x] prisma validate OK
- [x] bcrypt loads
- [x] .env not tracked by git

## PHASE COMPLETE: P1 (Express scaffold, env validation, health check, Prisma singleton)

**Files created**

- src/config/env.ts (Zod-validated env), src/lib/prisma.ts (singleton)
- src/routes/health.ts, src/app.ts, src/server.ts
- views/pages/hello.ejs (temporary), public/styles.css (base)

**Commands run**

- git add . && git commit -m "P0: schema, docker, plan, skeleton"
- npm run typecheck
- npm run dev
- curl -i http://127.0.0.1:3000/healthz

**Verify checklist passed**

- [x] typecheck clean
- [x] Server starts: "Chirp listening on http://localhost:3000 (development)"
- [x] /healthz returns 200 {"status":"ok","db":"up"}
- [x] / renders the EJS page with the styled heading

## PHASE COMPLETE: P2 (Auth)

**Files created**

- src/types/express.d.ts, src/lib/password.ts, src/validators/auth.ts
- src/config/session.ts, src/config/passport.ts
- src/middleware/csrf.ts, src/middleware/requireAuth.ts
- src/routes/auth.ts, updated src/app.ts
- views/partials/{head,nav,foot}.ejs, views/pages/{login,signup,home,error}.ejs
- updated public/styles.css, tsconfig.json (module/moduleResolution node16)

**Commands run**

- git add . && git commit -m "P1: express scaffold"
- npm run typecheck, npm run dev
- curl gate + CSRF tests, psql checks on "User" and session

**Verify checklist passed**

- [x] / redirects to /login when logged out; POST without CSRF token returns 403
- [x] Signup validation errors keep input; valid signup logs in and shows nav
- [x] Session persists across server restart (Postgres-backed)
- [x] Logout, wrong password, duplicate username, /login redirect when authed
- [x] passwordHash stored as bcrypt cost 12 ($2b$12$); cookie HttpOnly + SameSite=Lax

## PHASE COMPLETE: P3 (Posts CRUD)

**Files created**

- src/validators/post.ts, src/lib/postQueries.ts
- src/routes/home.ts, src/routes/posts.ts, updated src/app.ts
- views/partials/composeForm.ejs, views/pages/post.ejs, updated views/pages/home.ejs
- updated public/styles.css

**Commands run**

- npm run typecheck, npm run dev
- DevTools fetch tests for 403 (non-author delete) and 400 (281 chars)

**Verify checklist passed**

- [x] Create post; empty/whitespace rejected; HTML rendered as text
- [x] /posts/:id detail page; unknown id returns 404
- [x] Delete is author-only and enforced server-side (403 for non-author)
- [x] 280-char limit enforced server-side (400)

## PHASE COMPLETE: P4 (Feed with pagination)

**Files created**

- src/validators/pagination.ts, src/lib/feed.ts
- updated src/routes/home.ts, src/routes/posts.ts
- views/partials/pagination.ejs, updated views/pages/home.ejs
- updated public/styles.css

**Commands run**

- npm run typecheck, npm run dev
- psql: 25 generated test posts, temporary Follow row flipped between ACCEPTED and PENDING, test data cleanup

**Verify checklist passed**

- [x] 10 posts per page, newest first; Newer/Older links enable and disable correctly
- [x] ?page=abc and ?page=-5 show page 1; ?page=999 redirects to /
- [x] ACCEPTED follow shows the followed user's posts; PENDING does not
- [x] Follows are one-directional (sam's feed doesn't show dhruv's posts)

## PHASE COMPLETE: P5 (Likes, comments, \_postCard partial)

**Files created**

- src/lib/http.ts, src/lib/redirect.ts, src/validators/comment.ts
- updated src/lib/postQueries.ts, src/lib/feed.ts, src/routes/posts.ts, src/app.ts
- src/routes/comments.ts
- views/partials/\_postCard.ejs, updated views/pages/home.ejs and views/pages/post.ejs
- updated public/styles.css

**Commands run**

- npm run typecheck, npm run dev
- DevTools fetch tests (403 non-author comment delete, 400 over-length comment)
- psql duplicate Like insert and count checks

**Verify checklist passed**

- [x] Like toggles, returns to the same page; counts update
- [x] Comments create/delete; empty and 281-char comments rejected (400)
- [x] Non-author comment delete returns 403 and the comment survives
- [x] Duplicate Like insert fails on the unique constraint
- [x] HTML in posts is rendered as text

## PHASE COMPLETE: P6 (Follow system)

**Files created**

- src/lib/follows.ts, src/routes/users.ts, src/routes/requests.ts, updated src/app.ts
- views/partials/\_followButton.ejs, views/pages/users.ejs, views/pages/requests.ejs, updated views/partials/nav.ejs
- updated public/styles.css

**Commands run**

- psql cleanup of temporary Follow rows
- npm run typecheck, npm run dev
- DevTools fetch tests (403 non-recipient accept, 400 self-follow, 404 unknown user)
- psql duplicate Follow insert

**Verify checklist passed**

- [x] Follow -> Requested -> Accept -> Following / Follow Back; Reject deletes the row
- [x] Cancel pending request and unfollow work; nav badge updates
- [x] PENDING shows no posts in the feed; ACCEPTED does
- [x] Non-recipient accept returns 403; self-follow 400; unknown user 404
- [x] Duplicate follow blocked by the unique constraint

## PHASE COMPLETE: P7 (Profiles, user index, Gravatar)

**Files created**

- src/lib/gravatar.ts, src/lib/profile.ts, src/validators/user.ts
- updated src/lib/postQueries.ts, src/lib/follows.ts, src/routes/users.ts
- views/partials/\_avatar.ejs, views/pages/profile.ejs
- updated views/partials/{nav,pagination,\_postCard}.ejs, views/pages/{post,users,requests}.ejs
- updated public/styles.css

**Commands run**

- npm run typecheck, npm run dev
- psql: test bios, 25 temporary posts for pagination, cleanup

**Verify checklist passed**

- [x] Profile shows avatar, bio, counts, follow button, paginated posts
- [x] Avatars and profile links on cards, comments, /users, /requests
- [x] Unknown or invalid usernames return 404; usernames are case-insensitive
- [x] No email address appears in rendered HTML
- [x] Earlier flows (feed, likes, comments, follows) still work

## PHASE COMPLETE: P8 (Seed script)

**Files created**

- prisma/seed.js (replaces the P0 placeholder; wired via package.json "prisma.seed")

**Commands run**

- npx prisma db seed (twice, to prove idempotence)
- psql count and hash-prefix checks

**Verify checklist passed**

- [x] 20 users, 100 posts, 220 comments, 404 likes, mixed accepted/pending follows
- [x] Second run removes the 20 seeded users and recreates identical counts
- [x] demo / password123 works; /requests shows 3 requests; /users shows every button state
- [x] Real accounts (dhruv, sam, dpt033) untouched

## PHASE COMPLETE: P9 (Deploy, README, error pages, responsive CSS)

**Files created**

- render.yaml (Render web service; DATABASE_URL entered in Render, SESSION_SECRET generated)
- README.md, docs/screenshots/\*, public/favicon.svg
- updated src/app.ts (security headers, error handler), src/config/session.ts (Neon cold-start tolerant pool), src/routes/health.ts (/healthz liveness, /healthz/db readiness)
- updated views/pages/error.ejs, views/partials/head.ejs, public/styles.css (mobile and desktop layouts)

**Commands run**

- npm run typecheck && npm run build
- curl health, header and 413 checks; git ls-files checks
- prisma migrate deploy and prisma db seed against the Neon database
- Render Blueprint deploy from Drv2709/chirp

**Verify checklist passed**

- [x] Typecheck and build clean; /healthz and /healthz/db return 200; security headers present; oversized body returns 413
- [x] .env untracked; lockfile, migrations and render.yaml tracked
- [x] Neon migrated and seeded; Render deploy live; demo / password123 works on the live URL
- [x] Styled 404 and 500 pages; responsive on mobile and desktop


## PHASE COMPLETE: P10a (User search)

**Files created**
- src/validators/search.ts
- updated src/lib/follows.ts (optional search filter), src/routes/users.ts, views/pages/users.ejs, public/styles.css

**Commands run**
- npm run typecheck, npm run dev

**Verify checklist passed**
- [x] Search by username or display name, case-insensitive, partial matches
- [x] Empty results message; % and _ and HTML in the query are harmless
- [x] Follow/Unfollow on a result returns to the same search
- [x] Repeated or empty ?q= shows the full list


## PHASE COMPLETE: P10b (Followers / Following lists)

**Files created**
- src/lib/connections.ts
- updated src/routes/users.ts, views/pages/profile.ejs
- views/pages/connections.ejs

**Commands run**
- npm run typecheck, npm run dev

**Verify checklist passed**
- [x] Followers and Following counts on profiles are links to /users/:username/followers and /following
- [x] Lists show ACCEPTED follows only, so rows match the counts; pending requests excluded
- [x] Each row has the correct follow button and returns to the same list
- [x] Empty states, pagination redirects and 404s work