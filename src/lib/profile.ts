import { computeFollowState } from "./follows";
import { gravatarUrl } from "./gravatar";
import { postSelectFor, toPostCard } from "./postQueries";
import { prisma } from "./prisma";

export const PROFILE_PAGE_SIZE = 10;

export async function getProfile(username: string, viewerId: string) {
  const user = await prisma.user.findUnique({
    where: { username },
    select: {
      id: true,
      username: true,
      displayName: true,
      bio: true,
      email: true, // only used to compute the avatar URL
      createdAt: true,
      // My row toward them (Follow me -> them) and theirs toward me (them -> me).
      followers: { where: { followerId: viewerId }, select: { status: true }, take: 1 },
      following: { where: { followingId: viewerId }, select: { status: true }, take: 1 },
      // Public counts only include ACCEPTED follows.
      _count: {
        select: {
          posts: true,
          followers: { where: { status: "ACCEPTED" } },
          following: { where: { status: "ACCEPTED" } },
        },
      },
    },
  });

  if (!user) {
    return null;
  }

  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    bio: user.bio,
    createdAt: user.createdAt,
    avatarUrl: gravatarUrl(user.email, 192),
    postCount: user._count.posts,
    followerCount: user._count.followers,
    followingCount: user._count.following,
    followState: computeFollowState({
      viewerId,
      targetId: user.id,
      myRowStatus: user.followers[0]?.status ?? null,
      theirRowStatus: user.following[0]?.status ?? null,
    }),
  };
}

export async function getProfilePosts(authorId: string, viewerId: string, page: number) {
  const rows = await prisma.post.findMany({
    where: { authorId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * PROFILE_PAGE_SIZE,
    take: PROFILE_PAGE_SIZE + 1, // one extra row tells us whether a next page exists
    select: postSelectFor(viewerId),
  });

  const hasNext = rows.length > PROFILE_PAGE_SIZE;
  const pageRows = hasNext ? rows.slice(0, PROFILE_PAGE_SIZE) : rows;

  return {
    posts: pageRows.map(toPostCard),
    page,
    hasNext,
    hasPrev: page > 1,
  };
}