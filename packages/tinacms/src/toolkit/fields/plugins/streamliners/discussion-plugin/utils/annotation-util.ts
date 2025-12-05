import type { TText } from '@udecode/plate';
import { getDraftCommentKey } from '@udecode/plate-comments';
import type { CommentMessage, CommentThread } from '../plugins/comment-plugin';

export const createAnnotationId = (prefix: string) => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
};

export const getCommentIdsFromNode = (node?: Partial<TText> | null): string[] => {
  if (!node) return [];

  const COMMENT_KEY_PREFIX = 'comment_';
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

export {
  ensureCommentMark,
  clearCommentThread,
  DRAFT_COMMENT_KEY,
} from './comment-marks';
export {
  getSuggestionDiff,
  buildResolvedSuggestion,
  acceptActiveSuggestion,
  rejectActiveSuggestion,
} from '../../suggestion-plugin/utils/suggestion-helpers';
