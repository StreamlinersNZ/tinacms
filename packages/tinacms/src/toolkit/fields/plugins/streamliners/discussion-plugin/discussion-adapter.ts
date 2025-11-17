'use client';

import type { Value } from '@udecode/plate';

import type { CommentThread } from './comment-plugin';
import type { TComment, TDiscussion } from './types';

export const textToValue = (text: string): Value => [
  {
    children: [{ text }],
    type: 'p',
  },
];

export const valueToPlainText = (value: Value): string => {
  if (!Array.isArray(value)) return '';
  return value
    .map((block) =>
      Array.isArray(block.children)
        ? block.children.map((child: any) => child?.text ?? '').join('')
        : ''
    )
    .join('\n');
};

export const commentThreadsToDiscussions = (
  threads: Record<string, CommentThread>
): TDiscussion[] =>
  Object.values(threads).map((thread) => ({
    id: thread.id,
    comments: (thread.messages ?? []).map<TComment>((message, index) => ({
      id: message.id ?? `${thread.id}-message-${index}`,
      contentRich: textToValue(message.body ?? ''),
      createdAt: new Date(message.createdAt ?? new Date().toISOString()),
      updatedAt: message.updatedAt
        ? new Date(message.updatedAt)
        : undefined,
      discussionId: thread.id,
      isEdited: Boolean(message.updatedAt),
      userId: message.authorId ?? 'anonymous',
    })),
    createdAt: new Date(thread.createdAt ?? new Date().toISOString()),
    updatedAt: thread.updatedAt ? new Date(thread.updatedAt) : undefined,
    isResolved: Boolean(thread.isResolved),
    userId: thread.messages?.[0]?.authorId ?? 'anonymous',
    documentContent: thread.documentContent,
    discussionSubject: thread.discussionSubject,
  }));

export const discussionsToCommentThreads = (
  discussions: TDiscussion[]
): Record<string, CommentThread> =>
  discussions.reduce<Record<string, CommentThread>>((acc, discussion) => {
    acc[discussion.id] = {
      id: discussion.id,
      createdAt: discussion.createdAt.toISOString(),
      updatedAt: discussion.updatedAt?.toISOString(),
      isResolved: discussion.isResolved,
      documentContent: discussion.documentContent,
      discussionSubject: discussion.discussionSubject,
      messages: discussion.comments.map((comment) => ({
        id: comment.id,
        body: valueToPlainText(comment.contentRich),
        createdAt: comment.createdAt.toISOString(),
        updatedAt: comment.updatedAt?.toISOString(),
        authorId: comment.userId,
        authorName: comment.userId,
      })),
    };
    return acc;
  }, {});

export const areDiscussionsEqual = (
  a: TDiscussion[],
  b: TDiscussion[]
) => {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const aDisc = a[i];
    const bDisc = b[i];
    if (!bDisc) return false;
    if (aDisc.id !== bDisc.id) return false;
    if (aDisc.isResolved !== bDisc.isResolved) return false;
    if (aDisc.userId !== bDisc.userId) return false;
    if (aDisc.documentContent !== bDisc.documentContent) return false;
    if (aDisc.discussionSubject !== bDisc.discussionSubject) return false;
    if (aDisc.comments.length !== bDisc.comments.length) return false;
    for (let j = 0; j < aDisc.comments.length; j++) {
      const aComment = aDisc.comments[j];
      const bComment = bDisc.comments[j];
      if (!bComment) return false;
      if (aComment.id !== bComment.id) return false;
      if (aComment.userId !== bComment.userId) return false;
      if (
        JSON.stringify(aComment.contentRich) !==
        JSON.stringify(bComment.contentRich)
      ) {
        return false;
      }
    }
  }
  return true;
};
