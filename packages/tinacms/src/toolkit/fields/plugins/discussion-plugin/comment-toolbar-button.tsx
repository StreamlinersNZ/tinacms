'use client';

import * as React from 'react';

import { MessageSquareTextIcon } from 'lucide-react';
import { getDraftCommentKey } from '@udecode/plate-comments';
import { useEditorPlugin } from '@udecode/plate/react';

import { commentPlugin } from './comment-plugin';
import { ToolbarButton } from '../mdx-field-plugin/plate/components/plate-ui/toolbar';

export function CommentToolbarButton() {
  const { editor, setOption, tf } = useEditorPlugin(commentPlugin);

  const handleMouseDown = React.useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();

      console.log('[CommentToolbarButton] mouseDown', {
        hasSelection: Boolean(editor.selection),
        selection: editor.selection,
      });

      if (!editor.selection) {
        editor.tf.focus();
      }

      if (!editor.selection) {
        console.log('[CommentToolbarButton] still no selection after focus');
        return;
      }

      const draftKey = getDraftCommentKey();

      tf.comment?.setDraft();
      setOption('draft', { text: '' });
      setOption('activeId', draftKey);

      requestAnimationFrame(() => {
        setOption('activeId', draftKey);
      });

      console.log('[CommentToolbarButton] setDraft called');
      console.log(
        '[CommentToolbarButton] post-setDraft activeId',
        editor.getOption(commentPlugin, 'activeId')
      );
    },
    [editor, setOption, tf]
  );

  return (
    <ToolbarButton
      onMouseDown={handleMouseDown}
      data-plate-prevent-overlay
      tooltip="Comment"
      data-comment-toolbar-button="true"
    >
      <MessageSquareTextIcon />
    </ToolbarButton>
  );
}
