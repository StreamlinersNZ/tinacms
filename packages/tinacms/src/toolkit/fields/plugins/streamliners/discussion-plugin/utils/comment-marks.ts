import { type Path } from '@udecode/plate';
import {
  BaseCommentsPlugin,
  getCommentKey,
  getDraftCommentKey,
} from '@udecode/plate-comments';
import type { PlateEditor } from '@udecode/plate/react';
import { getSuggestionKey } from '@udecode/plate-suggestion';

import { commentPlugin } from '../plugins/comment-plugin';
import { suggestionPlugin } from '../../suggestion-plugin/suggestion-plugin';

export const DRAFT_COMMENT_KEY = getDraftCommentKey();

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
        },
        { at: path }
      );
    });
  });
};

export const clearCommentThread = (
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
      editor.tf.unsetNodes([BaseCommentsPlugin.key, commentKey, 'comment'], {
        at: path,
      });
    });
  });
  editor.getTransforms(commentPlugin).comment.unsetMark?.({ id: suggestionId });
};
