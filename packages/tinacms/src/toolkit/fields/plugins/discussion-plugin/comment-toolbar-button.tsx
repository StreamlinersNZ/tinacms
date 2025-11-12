'use client';

import * as React from 'react';

import { MessageSquareTextIcon } from 'lucide-react';
import { useEditorPlugin } from '@udecode/plate/react';

import { commentPlugin } from './comment-plugin';
import { ToolbarButton } from '../mdx-field-plugin/plate/components/plate-ui/toolbar';

export function CommentToolbarButton() {
  const { editor, tf } = useEditorPlugin(commentPlugin);

  const handleMouseDown = React.useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();

      if (!editor.selection) {
        editor.tf.focus();
      }

      if (!editor.selection) {
        return;
      }

      tf.comment?.setDraft();
    },
    [editor, tf]
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
