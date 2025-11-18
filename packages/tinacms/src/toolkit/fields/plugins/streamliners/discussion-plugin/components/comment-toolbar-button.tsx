import * as React from 'react';

import { MessageSquareTextIcon } from 'lucide-react';
import { useEditorPlugin } from '@udecode/plate/react';
import { BaseCommentsPlugin, getCommentKey } from '@udecode/plate-comments';
import { CommentsPlugin } from '@udecode/plate-comments/react';

import { commentPlugin } from '../plugins/comment-plugin';
import { ToolbarButton } from '../../../mdx-field-plugin/plate/components/plate-ui/toolbar';
import { createAnnotationId } from '../utils/annotation-util';
import { useAnnotationThreads } from '../hooks/use-annotation-state';

export function CommentToolbarButton() {
  const { editor, setOption } = useEditorPlugin(commentPlugin);
  const { commitThread } = useAnnotationThreads();

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

      // Create a new thread immediately with empty messages
      const threadId = createAnnotationId('comment-thread');
      const timestamp = new Date().toISOString();
      const commentsApi = editor.getApi(CommentsPlugin).comment;

      // Get the selected text directly from the selection
      const discussionSubject = editor.api.string(editor.selection)?.trim();

      if (!discussionSubject) return;

      const nextThread = {
        id: threadId,
        createdAt: timestamp,
        messages: [], // Empty messages - user will add the first message
        discussionSubject,
        documentContent: discussionSubject,
      };

      // Apply comment mark to the selection
      // Use split: true to allow marking partial text within nodes
      editor.tf.setNodes(
        {
          comment: true,
          [getCommentKey(threadId)]: true,
        },
        { at: editor.selection, match: (node) => editor.api.isText(node), split: true }
      );

      commitThread(nextThread);

      // Set active ID to show the thread
      setOption('activeId', threadId);
    },
    [commitThread, editor, setOption]
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
