'use client';

import { ElementApi, NodeApi, TextApi, type Path } from '@udecode/plate';
import {
  BaseCommentsPlugin,
  getCommentKey,
  getDraftCommentKey,
} from '@udecode/plate-comments';
import type { PlateEditor } from '@udecode/plate/react';
import {
  acceptSuggestion,
  getSuggestionKey,
  rejectSuggestion,
} from '@udecode/plate-suggestion';

import {
  commentPlugin,
  type CommentMessage,
  type CommentThread,
} from './comment-plugin';
import { suggestionPlugin } from '../suggestion-plugin/suggestion-plugin';
import type { SuggestionDiff } from '../suggestion-plugin/suggestion-plugin';

export const DRAFT_COMMENT_KEY = getDraftCommentKey();

export const createAnnotationId = (prefix: string) => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
};

export const formatTimestamp = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const now = new Date();
  const diffSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) return `${diffSeconds}s ago`;
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

export const collectHighlightedSubject = (entries: Array<[any, Path]>) => {
  const parts = entries
    .map(([node]) => {
      const text = NodeApi.string(node) ?? '';
      return text.replace(/\s+/g, ' ').trim();
    })
    .filter(Boolean);

  return parts.join(' ').replace(/\s+/g, ' ').trim();
};

export const ensureCommentMark = (
  editor: PlateEditor,
  suggestionId: string
) => {
  const suggestionKey = getSuggestionKey(suggestionId);
  const commentKey = getCommentKey(suggestionId);
  const suggestionApi = editor.getApi(suggestionPlugin).suggestion;
  const entries = Array.from(
    suggestionApi.nodes({ id: suggestionKey, text: true }) as Iterable<
      [any, Path]
    >
  );

  editor.tf.withoutNormalizing(() => {
    entries.forEach(([, path]) => {
      editor.tf.setNodes(
        {
          comment: true,
          [commentKey]: true,
          [BaseCommentsPlugin.key]: true,
        },
        { at: path }
      );
    });
  });
};

export const clearCommentThread = (editor: PlateEditor, suggestionId: string) => {
  const suggestionKey = getSuggestionKey(suggestionId);
  const commentKey = getCommentKey(suggestionId);
  const suggestionApi = editor.getApi(suggestionPlugin).suggestion;
  const entries = Array.from(
    suggestionApi.nodes({ id: suggestionKey, text: true }) as Iterable<
      [any, Path]
    >
  );

  editor.tf.withoutNormalizing(() => {
    entries.forEach(([, path]) => {
      editor.tf.unsetNodes([BaseCommentsPlugin.key, commentKey, 'comment'], {
        at: path,
      });
    });
  });
  editor.getTransforms(commentPlugin).comment.unsetMark?.({ id: suggestionId });
};

export const getSuggestionDiff = (
  editor: PlateEditor,
  suggestionId: string
): SuggestionDiff | null => {
  if (!suggestionId) return null;

  const suggestionApi = editor.getApi(suggestionPlugin).suggestion;
  const entries = Array.from(
    suggestionApi.nodes({ at: [], mode: 'all' }) as Iterable<[any, Path]>
  );

  let inserted = '';
  let deleted = '';

  for (const [node] of entries) {
    if (TextApi.isText(node)) {
      const dataList = suggestionApi.dataList(node);
      dataList.forEach((data) => {
        if (data.id !== suggestionId) return;
        const text = node.text ?? '';
        if (data.type === 'insert') {
          inserted += text;
        } else if (data.type === 'remove') {
          deleted += text;
        } else if (data.type === 'update') {
          inserted += text;
        }
      });
    } else if (ElementApi.isElement(node)) {
      const suggestionData = suggestionApi.isBlockSuggestion(node)
        ? node.suggestion
        : undefined;
      if (!suggestionData) continue;
      if (suggestionData.id !== suggestionId) continue;
      const label = `[${node.type}]`;
      if (suggestionData.type === 'insert') {
        inserted += label;
      } else {
        deleted += label;
      }
    }
  }

  const normalize = (value: string) => value.replace(/\s+/g, ' ').trim();
  inserted = normalize(inserted);
  deleted = normalize(deleted);

  if (!inserted && !deleted) return null;

  const type: SuggestionDiff['type'] =
    inserted && deleted ? 'replace' : inserted ? 'insert' : 'remove';

  return {
    insertedText: inserted || undefined,
    deletedText: deleted || undefined,
    type,
  };
};

export const buildResolvedSuggestion = ({
  suggestionId,
  diff,
  userId,
}: {
  suggestionId: string;
  diff: SuggestionDiff;
  userId?: string;
}) => ({
  createdAt: new Date(),
  keyId: suggestionId,
  suggestionId,
  type: diff.type,
  userId: userId ?? 'anonymous',
  ...(diff.deletedText ? { text: diff.deletedText } : {}),
  ...(diff.insertedText ? { newText: diff.insertedText } : {}),
});

export const acceptActiveSuggestion = ({
  editor,
  suggestionId,
  diff,
  userId,
}: {
  editor: PlateEditor;
  suggestionId: string;
  diff: SuggestionDiff;
  userId?: string;
}) => {
  const suggestionApi = editor.getApi(suggestionPlugin).suggestion;
  suggestionApi.withoutSuggestions(() => {
    acceptSuggestion(
      editor,
      buildResolvedSuggestion({ suggestionId, diff, userId })
    );
  });
};

export const rejectActiveSuggestion = ({
  editor,
  suggestionId,
  diff,
  userId,
}: {
  editor: PlateEditor;
  suggestionId: string;
  diff: SuggestionDiff;
  userId?: string;
}) => {
  const suggestionApi = editor.getApi(suggestionPlugin).suggestion;
  suggestionApi.withoutSuggestions(() => {
    rejectSuggestion(
      editor,
      buildResolvedSuggestion({ suggestionId, diff, userId })
    );
  });
};

export const appendMessageToThread = ({
  thread,
  body,
  author,
}: {
  thread: CommentThread;
  body: string;
  author: { id?: string; name?: string } | null;
}): CommentThread => {
  const timestamp = new Date().toISOString();
  const newMessage: CommentMessage = {
    id: createAnnotationId('comment'),
    body,
    createdAt: timestamp,
    authorId: author?.id,
    authorName: author?.name,
  };

  return {
    ...thread,
    updatedAt: timestamp,
    messages: [...(thread.messages ?? []), newMessage],
  };
};
