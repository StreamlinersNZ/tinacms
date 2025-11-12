'use client';

import React from 'react';

import { useEditorPlugin } from '@udecode/plate/react';

import { useAnnotationsStore } from './annotations-store';
import { commentPlugin } from './comment-plugin';

export function AnnotationPluginBridge() {
  const { annotations } = useAnnotationsStore();
  const { setOption } = useEditorPlugin(commentPlugin);

  React.useEffect(() => {
    setOption('comments', annotations.comments);
  }, [annotations.comments, setOption]);

  return null;
}
