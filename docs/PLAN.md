# Chirp: Plan

A minimal Twitter clone: text posts, follow requests with approval, likes, comments.

## Stack (locked)
Node.js + Express, TypeScript (strict), PostgreSQL (Docker local, Render prod), Prisma,
passport-local + bcrypt + express-session + connect-pg-simple, EJS, plain CSS, @faker-js/faker.

## ERD

```
┌────────────────────┐        ┌──────────────────────┐
│ User               │ 1    * │ Post                 │
│────────────────────│────────│──────────────────────│
│ id (PK, cuid)      │        │ id (PK)              │
│ username (UQ)      │        │ content (<=280)      │
│ email (UQ)         │        │ authorId (FK→User)   │  idx: authorId, createdAt
│ passwordHash       │        │ createdAt            │  onDelete: Cascade (User→Post)
│ displayName        │        └─────────┬────────────┘
│ bio                │                  │ 1
│ createdAt          │          ┌───────┴────────┐
└──┬──────┬──────┬───┘          │ *              │ *
   │      │      │      ┌───────┴──────┐ ┌───────┴──────────┐
   │      │      │      │ Like         │ │ Comment          │
   │      │      │      │──────────────│ │──────────────────│
   │      │      └──────│ id (PK)      │ │ id (PK)          │
   │      │   1      *  │ userId (FK)  │ │ content (<=280)  │
   │      │             │ postId (FK)  │ │ authorId (FK)    │
   │      │             │ createdAt    │ │ postId (FK)      │ idx: postId
   │      │             │ UQ(userId,   │ │ createdAt        │
   │      │             │    postId)   │ └──────────────────┘
   │      │             │ idx: postId  │  (all FKs onDelete: Cascade)
   │      │             └──────────────┘
   │      │
   │ 1  * │ 1  *
┌──┴──────┴──────────────────────────────┐
│ Follow  (self-referencing join on User)│
│────────────────────────────────────────│
│ id (PK)                                │
│ followerId  (FK→User)  "who asked"     │
│ followingId (FK→User)  "who is asked"  │  idx: followingId
│ status: PENDING | ACCEPTED             │  UQ(followerId, followingId)
│ createdAt                              │  onDelete: Cascade (both sides)
└────────────────────────────────────────┘

┌────────────────────┐
│ session            │  Managed by connect-pg-simple
│ sid (PK), sess,    │  (declared in Prisma so migrations create it)
│ expire (idx)       │
└────────────────────┘
```

### Follow state machine
- Follow click → row created with `PENDING`
- Target accepts → `ACCEPTED`
- Target rejects → row **deleted** (so the requester can request again)
- Unfollow / cancel request → row **deleted**
- Feed shows self + users where `Follow(followerId=me, status=ACCEPTED)`

### `/users` button states (viewer = me, row = other user)
| Condition | Button |
|---|---|
| other.id == me.id | You (disabled) |
| my row → them is PENDING | Requested (cancel) |
| my row → them is ACCEPTED | Following (unfollow) |
| their row → me is PENDING | Respond via /requests |
| their row → me is ACCEPTED, no row from me | Follow Back |
| no rows either way | Follow |

## Page map

| Route | Method | Auth | Purpose |
|---|---|---|---|
| `/login` | GET/POST | public | Login form / authenticate |
| `/signup` | GET/POST | public | Register form / create user |
| `/logout` | POST | user | Destroy session |
| `/` | GET | user | Feed: self + ACCEPTED follows, paginated |
| `/posts` | POST | user | Create post |
| `/posts/:id` | GET | user | Post detail: author, content, likes, comments |
| `/posts/:id/delete` | POST | author | Delete post |
| `/posts/:id/like` | POST | user | Toggle like |
| `/posts/:id/comments` | POST | user | Add comment |
| `/comments/:id/delete` | POST | author | Delete comment |
| `/users` | GET | user | All users + follow button states |
| `/users/:username` | GET | user | Profile: avatar, bio, posts |
| `/users/:id/follow` | POST | user | Send follow request |
| `/users/:id/unfollow` | POST | user | Unfollow / cancel request |
| `/requests` | GET | user | Incoming pending requests |
| `/requests/:id/accept` | POST | recipient | Accept |
| `/requests/:id/reject` | POST | recipient | Reject (delete row) |
| `/healthz` | GET | public | Health check (P1) |

Auth gate: everything redirects to `/login` except `/login`, `/signup`, `/healthz`, and static assets.

## Phases
P0 schema/plan → P1 scaffold → P2 auth → P3 posts → P4 feed → P5 likes/comments/partial →
P6 follows → P7 profiles/users/Gravatar → P8 seed → P9 deploy/README/404/500/CSS → P10 extras (only on request)

## Security baseline (every phase)
bcrypt cost ≥ 10; never log/return passwordHash; cookie httpOnly + sameSite=lax + secure in prod;
Zod validation on all input (post/comment ≤ 280, non-empty); server-side ownership checks;
SESSION_SECRET from `.env`; CSRF token on every state-changing form.