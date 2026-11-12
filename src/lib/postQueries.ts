import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

// One explicit select shared by every place that renders a post card.
// `likes` is filtered to the viewer, so likes.length is 0 or 1 ("did I like it?").
export function postSelectFor(viewerId: string) {
  return {
    id: true,
    content: true,
    createdAt: true,
    author: {
      select: { id: true, username: true, displayName: true },
    },
    _count: { select: { likes: true, comments: true } },
    likes: { where: { userId: viewerId }, select: { id: true }, take: 1 },
  } satisfies Prisma.PostSelect;
}

type PostRow = Prisma.PostGetPayload<{ select: ReturnType<typeof postSelectFor> }>;

// Flattens a DB row into exactly what _postCard.ejs needs.
export function toPostCard(post: PostRow) {
  return {
    id: post.id,
    content: post.content,
    createdAt: post.createdAt,
    author: post.author,
    likeCount: post._count.likes,
    commentCount: post._count.comments,
    likedByMe: post.likes.length > 0,
  };
}

export type PostCard = ReturnType<typeof toPostCard>;

export async function findPostCard(postId: string, viewerId: string): Promise<PostCard | null> {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: postSelectFor(viewerId),
  });
  return post ? toPostCard(post) : null;
}

// Full thread, oldest first.
export function findComments(postId: string) {
  return prisma.comment.findMany({
    where: { postId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      content: true,
      createdAt: true,
      author: {
        select: { id: true, username: true, displayName: true },
      },
    },
  });
}