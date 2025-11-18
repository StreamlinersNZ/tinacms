'use client';

import type { TText } from '@udecode/plate';
import { getDraftCommentKey } from '@udecode/plate-comments';

const COMMENT_KEY_PREFIX = 'comment_';

/**
 * Returns every comment thread ID applied to the provided text node.
 * Draft comment keys and the generic `comment` boolean flag are ignored.
 */
export const getCommentIdsFromNode = (node?: Partial<TText> | null): string[] => {
  if (!node) return [];

  const draftKey = getDraftCommentKey();

  return Object.keys(node)
    .filter((key) => {
      if (!key.startsWith(COMMENT_KEY_PREFIX)) return false;
      if (key === 'comment') return false;
      if (key === draftKey) return false;
      return true;
    })
    .map((key) => key.slice(COMMENT_KEY_PREFIX.length));
};
