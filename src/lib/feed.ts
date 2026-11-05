import { prisma } from "./prisma";
import { postSelect } from "./postQueries";

export const FEED_PAGE_SIZE = 10;

// Feed = my posts + posts from users I follow with an ACCEPTED follow.
// PENDING follows never appear. author.followers are Follow rows where followingId = author.
export async function getFeedPage(userId: string, page: number) {
  const rows = await prisma.post.findMany({
    where: {
      OR: [
        { authorId: userId },
        {
          author: {
            followers: {
              some: { followerId: userId, status: "ACCEPTED" },
            },
          },
        },
      ],
    },
    // id as a tiebreaker keeps ordering stable for posts created in the same millisecond.
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * FEED_PAGE_SIZE,
    take: FEED_PAGE_SIZE + 1, // one extra row tells us whether a next page exists
    select: postSelect,
  });

  const hasNext = rows.length > FEED_PAGE_SIZE;

  return {
    posts: hasNext ? rows.slice(0, FEED_PAGE_SIZE) : rows,
    page,
    hasNext,
    hasPrev: page > 1,
  };
}