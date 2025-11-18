
import { NodeApi, TextApi } from '@udecode/plate';
import type { PlateEditor } from '@udecode/plate/react';
import {
  getCommentCount,
  getCommentKeyId,
  getDraftCommentKey,
  isCommentKey,
} from '@udecode/plate-comments';

import type { CommentMessage, CommentThread } from '../plugins/comment-plugin';

const draftKey = getDraftCommentKey();

export const areCommentMapsEqual = (
  commentA: Record<string, CommentThread>,
  commentB: Record<string, CommentThread>
) => {
  if (commentA === commentB) return true;
  const aKeys = Object.keys(commentA);
  const bKeys = Object.keys(commentB);

  if (aKeys.length !== bKeys.length) return false;

  for (const key of aKeys) {
    const commentAValue = commentA[key];
    const commentBValue = commentB[key];

    if (!commentBValue) return false;

    if (commentAValue.createdAt !== commentBValue.createdAt) return false;
    if (commentAValue.updatedAt !== commentBValue.updatedAt) return false;
    if (commentAValue.isResolved !== commentBValue.isResolved) return false;
    if (commentAValue.documentContent !== commentBValue.documentContent)
      return false;
    if (commentAValue.discussionSubject !== commentBValue.discussionSubject)
      return false;

    const aMessages = commentAValue.messages ?? [];
    const bMessages = commentBValue.messages ?? [];

    if (aMessages.length !== bMessages.length) return false;

    for (let i = 0; i < aMessages.length; i++) {
      const aMessage = aMessages[i];
      const bMessage = bMessages[i];

      if (
        !bMessage ||
        aMessage.id !== bMessage.id ||
        aMessage.body !== bMessage.body ||
        aMessage.createdAt !== bMessage.createdAt ||
        aMessage.updatedAt !== bMessage.updatedAt ||
        aMessage.authorId !== bMessage.authorId ||
        aMessage.authorName !== bMessage.authorName
      ) {
        return false;
      }
    }
  }

  return true;
};

export const extractCommentRecords = (
  editor: PlateEditor,
  existing: Record<string, CommentThread>
): Record<string, CommentThread> => {
  const records: Record<string, CommentThread> = {};
  let hasStructuredData = false;

  const entries = editor.api.nodes({
    at: [],
    match: (node: any) => TextApi.isText(node) && getCommentCount(node) > 0,
    mode: 'all',
  });

  for (const [node] of entries) {
    Object.entries(node).forEach(([key, value]) => {
      if (!isCommentKey(key) || key === draftKey) return;

      const id = getCommentKeyId(key);
      if (!id) return;

      const highlightText = NodeApi.string(node) ?? '';
      const normalizedHighlight = highlightText.replace(/\s+/g, ' ').trim();
      const existingRecord = records[id] ?? existing[id];

      if (typeof value === 'object' && value !== null) {
        hasStructuredData = true;
        const { messages, createdAt, updatedAt, ...rest } =
          (value as CommentThread) ?? {};
        const restTyped = rest as Partial<CommentThread>;
        const baseSubject = (
          restTyped.discussionSubject ??
          existingRecord?.discussionSubject ??
          ''
        ).trim();
        const shouldAppendHighlight =
          normalizedHighlight &&
          !baseSubject
            .toLowerCase()
            .includes(normalizedHighlight.toLowerCase());
        const discussionSubject = shouldAppendHighlight
          ? [baseSubject, normalizedHighlight]
              .filter(Boolean)
              .join(' ')
              .replace(/\s+/g, ' ')
              .trim()
          : baseSubject;

        records[id] = {
          id,
          createdAt: createdAt ?? existing[id]?.createdAt ?? '',
          updatedAt: updatedAt ?? existing[id]?.updatedAt,
          isResolved: restTyped.isResolved ?? existing[id]?.isResolved,
          documentContent:
            restTyped.documentContent ?? existing[id]?.documentContent,
          discussionSubject,
          messages: (messages ?? existing[id]?.messages ?? []).map(
            (message: CommentMessage, index) => ({
              id: message.id ?? `${id}-message-${index}`,
              body: message.body ?? '',
              createdAt:
                message.createdAt ??
                existing[id]?.messages?.[index]?.createdAt ??
                '',
              updatedAt:
                message.updatedAt ??
                existing[id]?.messages?.[index]?.updatedAt,
              authorId:
                message.authorId ?? existing[id]?.messages?.[index]?.authorId,
              authorName:
                message.authorName ??
                existing[id]?.messages?.[index]?.authorName,
            })
          ),
        };
      } else {
        const fallback = existing[id];
        const baseSubject = (
          fallback?.discussionSubject ??
          records[id]?.discussionSubject ??
          ''
        ).trim();
        const shouldAppendHighlight =
          normalizedHighlight &&
          !baseSubject
            .toLowerCase()
            .includes(normalizedHighlight.toLowerCase());
        const discussionSubject = shouldAppendHighlight
          ? [baseSubject, normalizedHighlight]
              .filter(Boolean)
              .join(' ')
              .replace(/\s+/g, ' ')
              .trim()
          : baseSubject;

        records[id] = {
          id,
          createdAt: fallback?.createdAt ?? '',
          updatedAt: fallback?.updatedAt,
          isResolved: fallback?.isResolved,
          documentContent: fallback?.documentContent,
          discussionSubject,
          messages: fallback?.messages ?? [],
        };
      }
    });
  }

  if (!hasStructuredData) {
    return existing;
  }

  return records;
};
