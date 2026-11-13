import { computeFollowState } from "./follows";
import { gravatarUrl } from "./gravatar";
import { prisma } from "./prisma";

export const SUGGESTION_COUNT = 4;

// "Who to follow": people I have no follow row with (no pending request, not following),
// most-followed first. The viewer is excluded.
export async function getSuggestions(viewerId: string) {
  const users = await prisma.user.findMany({
    where: {
      id: { not: viewerId },
      // Follow rows where followingId = this user; none of them came from me.
      followers: { none: { followerId: viewerId } },
    },
    orderBy: [{ followers: { _count: "desc" } }, { username: "asc" }],
    take: SUGGESTION_COUNT,
    select: {
      id: true,
      username: true,
      displayName: true,
      email: true, // only used to compute the avatar URL
      // Follow rows aimed at me (them -> me), so we can show "Follow Back" / "Respond".
      following: { where: { followingId: viewerId }, select: { status: true }, take: 1 },
    },
  });

  return users.map((user) => ({
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: gravatarUrl(user.email, 80),
    followState: computeFollowState({
      viewerId,
      targetId: user.id,
      myRowStatus: null,
      theirRowStatus: user.following[0]?.status ?? null,
    }),
  }));
}