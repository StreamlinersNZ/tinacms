'use client';

import React from 'react';

import type { PlateEditor } from '@udecode/plate/react';
import {
  getCommentCount,
  getCommentKeyId,
  getDraftCommentKey,
  isCommentKey,
} from '@udecode/plate-comments';
import { NodeApi, TextApi } from '@udecode/plate';
import { useEditorPlugin, usePluginOption } from '@udecode/plate/react';

import {
  commentPlugin,
  type CommentMessage,
  type CommentThread,
} from './comment-plugin';

const draftKey = getDraftCommentKey();

const areThreadsEqual = (
  commentA: Record<string, CommentThread>,
  commentB: Record<string, CommentThread>
): boolean => {
  const aKeys = Object.keys(commentA);
  const bKeys = Object.keys(commentB);

  if (aKeys.length !== bKeys.length) return false;

  for (let i = 0; i < aKeys.length; i++) {
    const key = aKeys[i];
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

    if (commentAValue.messages?.length !== commentBValue.messages?.length) {
      return false;
    }
  }

  return true;
};

const extractCommentRecords = (
  editor: PlateEditor,
  existing: Record<string, CommentThread>
): Record<string, CommentThread> => {
  const records: Record<string, CommentThread> = {};

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
      const normalizedHighlight = highlightText
        .replace(/\s+/g, ' ')
        .trim();
      const existingRecord = records[id] ?? existing[id];

      if (typeof value === 'object' && value !== null) {
        const { messages, createdAt, updatedAt, ...rest } =
          (value as CommentThread) ?? {};
        const baseSubject = (
          (value as CommentThread)?.discussionSubject ??
          existingRecord?.discussionSubject ??
          ''
        ).trim();
        const shouldAppendHighlight =
          normalizedHighlight &&
          !baseSubject.toLowerCase().includes(
            normalizedHighlight.toLowerCase()
          );
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
          isResolved: rest.isResolved ?? existing[id]?.isResolved,
          documentContent: rest.documentContent ?? existing[id]?.documentContent,
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
        // Legacy data: fall back to existing if available
        const fallback = existing[id];
        const baseSubject = (
          fallback?.discussionSubject ??
          records[id]?.discussionSubject ??
          ''
        ).trim();
        const shouldAppendHighlight =
          normalizedHighlight &&
          !baseSubject.toLowerCase().includes(
            normalizedHighlight.toLowerCase()
          );
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

  return records;
};

export function CommentStateSynchronizer() {
  const { editor, setOption } = useEditorPlugin(commentPlugin);
  const currentComments =
    (usePluginOption(commentPlugin, 'comments') as Record<
      string,
      CommentThread
    >) ?? {};

  React.useEffect(() => {
    const derived = extractCommentRecords(editor, currentComments);

    if (!areThreadsEqual(currentComments, derived)) {
      setOption('comments', derived);
    }
  }, [editor, setOption, currentComments, editor.children]);

  return null;
}
