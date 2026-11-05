import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

// One explicit select shared by every place that renders a post.
export const postSelect = {
  id: true,
  content: true,
  createdAt: true,
  author: {
    select: { id: true, username: true, displayName: true },
  },
} satisfies Prisma.PostSelect;

export function findPostsByAuthor(authorId: string, take = 20) {
  return prisma.post.findMany({
    where: { authorId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take,
    select: postSelect,
  });
}
