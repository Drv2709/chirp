import type { FollowStatus } from "@prisma/client";
import { gravatarUrl } from "./gravatar";
import { prisma } from "./prisma";

export type FollowState =
  | "self" // it's me
  | "none" // no relationship: show "Follow"
  | "requested" // my request is PENDING: show "Requested" (click cancels)
  | "following" // my request is ACCEPTED: show "Following" (click unfollows)
  | "follow_back" // they follow me (ACCEPTED), I don't follow them: show "Follow Back"
  | "incoming"; // they sent me a PENDING request: send me to /requests

export function computeFollowState(args: {
  viewerId: string;
  targetId: string;
  myRowStatus: FollowStatus | null; // Follow(me -> them)
  theirRowStatus: FollowStatus | null; // Follow(them -> me)
}): FollowState {
  if (args.viewerId === args.targetId) return "self";
  if (args.myRowStatus === "PENDING") return "requested";
  if (args.myRowStatus === "ACCEPTED") return "following";
  if (args.theirRowStatus === "PENDING") return "incoming";
  if (args.theirRowStatus === "ACCEPTED") return "follow_back";
  return "none";
}

export async function listUsersWithFollowState(viewerId: string) {
  const users = await prisma.user.findMany({
    orderBy: [{ username: "asc" }],
    take: 200,
    select: {
      id: true,
      username: true,
      displayName: true,
      bio: true,
      email: true, // only used to compute the avatar URL
      // Follow rows where followingId = this user, filtered to the ones I sent (me -> them).
      followers: { where: { followerId: viewerId }, select: { status: true }, take: 1 },
      // Follow rows where followerId = this user, filtered to the ones aimed at me (them -> me).
      following: { where: { followingId: viewerId }, select: { status: true }, take: 1 },
    },
  });

  return users.map((u) => ({
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    bio: u.bio,
    avatarUrl: gravatarUrl(u.email, 80),
    followState: computeFollowState({
      viewerId,
      targetId: u.id,
      myRowStatus: u.followers[0]?.status ?? null,
      theirRowStatus: u.following[0]?.status ?? null,
    }),
  }));
}

export async function listIncomingRequests(userId: string) {
  const requests = await prisma.follow.findMany({
    where: { followingId: userId, status: "PENDING" },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      createdAt: true,
      follower: {
        select: { id: true, username: true, displayName: true, bio: true, email: true },
      },
    },
  });

  return requests.map((request) => ({
    id: request.id,
    createdAt: request.createdAt,
    follower: {
      id: request.follower.id,
      username: request.follower.username,
      displayName: request.follower.displayName,
      bio: request.follower.bio,
      avatarUrl: gravatarUrl(request.follower.email, 80),
    },
  }));
}

export function countIncomingRequests(userId: string): Promise<number> {
  return prisma.follow.count({
    where: { followingId: userId, status: "PENDING" },
  });
}