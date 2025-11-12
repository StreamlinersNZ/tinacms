'use client';

import React from 'react';

import { useEditorPlugin } from '@udecode/plate/react';

import { commentPlugin } from './comment-plugin';
import { useAnnotationsStore } from './annotations-store';
import {
  areCommentMapsEqual,
  extractCommentRecords,
} from './comment-annotations';

export function CommentStateSynchronizer() {
  const { editor } = useEditorPlugin(commentPlugin);
  const { annotations, setComments } = useAnnotationsStore();

  React.useEffect(() => {
    const derived = extractCommentRecords(editor, annotations.comments);

    if (!areCommentMapsEqual(annotations.comments, derived)) {
      setComments(derived);
    }
  }, [editor, annotations.comments, setComments, editor.children]);

  return null;
}
