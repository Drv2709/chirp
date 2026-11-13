/* eslint-disable no-console */
require("dotenv/config");
const bcrypt = require("bcrypt");
const { faker } = require("@faker-js/faker");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const SEED_EMAIL_DOMAIN = "seed.chirp.test";
const PASSWORD = "password123";
const USER_COUNT = 20; // includes the "demo" user
const POST_COUNT = 100;
const COMMENT_COUNT = 220;
const MAX_LIKES_PER_POST = 8;
const RANDOM_FOLLOW_PROBABILITY = 0.22;
const ACCEPTED_PROBABILITY = 0.7;

faker.seed(42);

// ---------- helpers ----------

function clip(text, max) {
  return text.length <= max ? text : text.slice(0, max - 1).trimEnd() + "…";
}

function makeUsername(taken) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const name = faker.internet
      .username()
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 20);
    if (name.length >= 3 && !taken.has(name)) {
      taken.add(name);
      return name;
    }
  }
  throw new Error("Could not generate a unique username.");
}

function postText() {
  const kind = faker.number.int({ min: 1, max: 4 });
  let text;
  if (kind === 1) text = faker.company.catchPhrase() + ".";
  else if (kind === 2) text = faker.hacker.phrase();
  else if (kind === 3) text = faker.lorem.sentences({ min: 1, max: 3 });
  else text = faker.lorem.sentence({ min: 4, max: 14 });
  return clip(text, 280);
}

function commentText() {
  const text = faker.datatype.boolean()
    ? faker.hacker.phrase()
    : faker.lorem.sentence({ min: 3, max: 10 });
  return clip(text, 280);
}

// ---------- main ----------

async function main() {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.SEED_CONFIRM !== "yes"
  ) {
    console.error(
      "Refusing to seed in production. Re-run with SEED_CONFIRM=yes to proceed.",
    );
    process.exit(1);
  }

  console.log("Seeding Chirp...");

  // 1. Remove previous seed data only. Cascades delete their posts, comments, likes, follows.
  const removed = await prisma.user.deleteMany({
    where: { email: { endsWith: `@${SEED_EMAIL_DOMAIN}` } },
  });
  console.log(
    `Removed ${removed.count} previously seeded users (and their data).`,
  );

  // 2. Avoid clashing with real accounts.
  const existing = await prisma.user.findMany({ select: { username: true } });
  const taken = new Set(existing.map((u) => u.username));
  if (taken.has("demo")) {
    throw new Error(
      'A non-seed user named "demo" already exists. Rename or delete it, then re-run.',
    );
  }
  taken.add("demo");

  // 3. Users (one shared bcrypt hash: every seeded user has the same password).
  const passwordHash = await bcrypt.hash(PASSWORD, 12);

  const userData = [
    {
      username: "demo",
      email: `demo@${SEED_EMAIL_DOMAIN}`,
      displayName: "Demo User",
      bio: "Demo account for Chirp. Log in with password123.",
      passwordHash,
    },
  ];

  for (let i = 1; i < USER_COUNT; i += 1) {
    const username = makeUsername(taken);
    userData.push({
      username,
      email: `${username}@${SEED_EMAIL_DOMAIN}`,
      displayName: clip(faker.person.fullName(), 50),
      bio: clip(faker.person.bio(), 160),
      passwordHash,
    });
  }

  const users = await prisma.user.createManyAndReturn({
    data: userData,
    select: { id: true, username: true },
  });

  const demo = users.find((u) => u.username === "demo");
  const others = users
    .filter((u) => u.username !== "demo")
    .sort((a, b) => a.username.localeCompare(b.username));

  // 4. Follow graph.
  const edges = new Map();
  function addEdge(follower, following, status) {
    if (follower.id === following.id) return;
    const key = `${follower.id}>${following.id}`;
    if (edges.has(key)) return;
    edges.set(key, {
      followerId: follower.id,
      followingId: following.id,
      status,
    });
  }

  // Fixed relationships for demo so every /users button state is visible.
  others.slice(0, 6).forEach((u) => addEdge(demo, u, "ACCEPTED")); //   Following
  others.slice(6, 9).forEach((u) => addEdge(u, demo, "PENDING")); //    Respond (inbox)
  others.slice(9, 12).forEach((u) => addEdge(u, demo, "ACCEPTED")); //  Follow Back
  others.slice(12, 14).forEach((u) => addEdge(demo, u, "PENDING")); //  Requested

  // Random relationships between everyone else.
  for (const follower of others) {
    for (const following of others) {
      if (
        follower.id !== following.id &&
        faker.datatype.boolean({ probability: RANDOM_FOLLOW_PROBABILITY })
      ) {
        addEdge(
          follower,
          following,
          faker.datatype.boolean({ probability: ACCEPTED_PROBABILITY })
            ? "ACCEPTED"
            : "PENDING",
        );
      }
    }
  }

  await prisma.follow.createMany({ data: [...edges.values()] });

  // 5. Posts: everyone posts once, the rest are spread randomly. Newest within the last 30 days.
  const authorIds = users.map((u) => u.id);
  while (authorIds.length < POST_COUNT) {
    authorIds.push(faker.helpers.arrayElement(users).id);
  }

  const posts = await prisma.post.createManyAndReturn({
    data: faker.helpers.shuffle(authorIds).map((authorId) => ({
      authorId,
      content: postText(),
      createdAt: faker.date.recent({ days: 30 }),
    })),
    select: { id: true, createdAt: true },
  });

  // 6. Likes: 0..MAX distinct users per post (the unique constraint is also respected by skipDuplicates).
  const likeData = [];
  for (const post of posts) {
    const likers = faker.helpers.arrayElements(
      users,
      faker.number.int({ min: 0, max: MAX_LIKES_PER_POST }),
    );
    for (const liker of likers) {
      likeData.push({
        userId: liker.id,
        postId: post.id,
        createdAt: faker.date.between({ from: post.createdAt, to: new Date() }),
      });
    }
  }
  await prisma.like.createMany({ data: likeData, skipDuplicates: true });

  // 7. Comments, always after the post they belong to.
  const commentData = [];
  for (let i = 0; i < COMMENT_COUNT; i += 1) {
    const post = faker.helpers.arrayElement(posts);
    commentData.push({
      postId: post.id,
      authorId: faker.helpers.arrayElement(users).id,
      content: commentText(),
      createdAt: faker.date.between({ from: post.createdAt, to: new Date() }),
    });
  }
  await prisma.comment.createMany({ data: commentData });

  // 8. Summary (scoped to seeded users so your real accounts don't skew the numbers).
  const seeded = { email: { endsWith: `@${SEED_EMAIL_DOMAIN}` } };
  const [userCount, postCount, commentCount, likeCount, accepted, pending] =
    await Promise.all([
      prisma.user.count({ where: seeded }),
      prisma.post.count({ where: { author: seeded } }),
      prisma.comment.count({ where: { author: seeded } }),
      prisma.like.count({ where: { user: seeded } }),
      prisma.follow.count({ where: { follower: seeded, status: "ACCEPTED" } }),
      prisma.follow.count({ where: { follower: seeded, status: "PENDING" } }),
    ]);

  console.log("");
  console.log("Seed complete:");
  console.log(`  users:    ${userCount}`);
  console.log(`  posts:    ${postCount}`);
  console.log(`  comments: ${commentCount}`);
  console.log(`  likes:    ${likeCount}`);
  console.log(`  follows:  ${accepted} accepted, ${pending} pending`);
  console.log("");
  console.log(`All seeded users share the password: ${PASSWORD}`);
  console.log("Demo login: demo / password123");
  console.log(
    `Usernames: ${users
      .map((u) => u.username)
      .sort()
      .join(", ")}`,
  );
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
