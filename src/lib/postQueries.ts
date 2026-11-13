import type { Prisma } from "@prisma/client";
import { gravatarUrl } from "./gravatar";
import { prisma } from "./prisma";

// Email is selected only to compute the Gravatar URL; it is never passed on to templates.
const authorSelect = {
  id: true,
  username: true,
  displayName: true,
  email: true,
} satisfies Prisma.UserSelect;

type AuthorRow = Prisma.UserGetPayload<{ select: typeof authorSelect }>;

function toAuthor(author: AuthorRow) {
  return {
    id: author.id,
    username: author.username,
    displayName: author.displayName,
    avatarUrl: gravatarUrl(author.email, 80),
  };
}

// One explicit select shared by every place that renders a post card.
// `likes` is filtered to the viewer, so likes.length is 0 or 1 ("did I like it?").
export function postSelectFor(viewerId: string) {
  return {
    id: true,
    content: true,
    createdAt: true,
    author: { select: authorSelect },
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
    author: toAuthor(post.author),
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
export async function findComments(postId: string) {
  const comments = await prisma.comment.findMany({
    where: { postId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      content: true,
      createdAt: true,
      author: { select: authorSelect },
    },
  });

  return comments.map((comment) => ({
    id: comment.id,
    content: comment.content,
    createdAt: comment.createdAt,
    author: toAuthor(comment.author),
  }));
}