import type { Prisma } from "@prisma/client";
import { computeFollowState } from "./follows";
import { gravatarUrl } from "./gravatar";
import { prisma } from "./prisma";

export const CONNECTIONS_PAGE_SIZE = 20;

export type ConnectionKind = "followers" | "following";

// One explicit select for every user shown in a list. `email` is used only to compute the avatar URL.
function listedUserSelect(viewerId: string) {
  return {
    id: true,
    username: true,
    displayName: true,
    bio: true,
    email: true,
    // Follow rows I sent to this user (me -> them) and ones they sent me (them -> me).
    followers: { where: { followerId: viewerId }, select: { status: true }, take: 1 },
    following: { where: { followingId: viewerId }, select: { status: true }, take: 1 },
  } satisfies Prisma.UserSelect;
}

type ListedUser = Prisma.UserGetPayload<{ select: ReturnType<typeof listedUserSelect> }>;

function toListedUser(user: ListedUser, viewerId: string) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    bio: user.bio,
    avatarUrl: gravatarUrl(user.email, 80),
    followState: computeFollowState({
      viewerId,
      targetId: user.id,
      myRowStatus: user.followers[0]?.status ?? null,
      theirRowStatus: user.following[0]?.status ?? null,
    }),
  };
}

// Followers of `profileId` (people who follow them) or the people they follow.
// Only ACCEPTED follows are listed, so the lists always match the public counts.
export async function getConnections(
  profileId: string,
  viewerId: string,
  kind: ConnectionKind,
  page: number,
) {
  const skip = (page - 1) * CONNECTIONS_PAGE_SIZE;
  const take = CONNECTIONS_PAGE_SIZE + 1; // one extra row tells us whether a next page exists

  let users: ListedUser[];

  if (kind === "followers") {
    const rows = await prisma.follow.findMany({
      where: { followingId: profileId, status: "ACCEPTED" },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip,
      take,
      select: { follower: { select: listedUserSelect(viewerId) } },
    });
    users = rows.map((row) => row.follower);
  } else {
    const rows = await prisma.follow.findMany({
      where: { followerId: profileId, status: "ACCEPTED" },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip,
      take,
      select: { following: { select: listedUserSelect(viewerId) } },
    });
    users = rows.map((row) => row.following);
  }

  const hasNext = users.length > CONNECTIONS_PAGE_SIZE;
  const pageUsers = hasNext ? users.slice(0, CONNECTIONS_PAGE_SIZE) : users;

  return {
    users: pageUsers.map((user) => toListedUser(user, viewerId)),
    page,
    hasNext,
    hasPrev: page > 1,
  };
}