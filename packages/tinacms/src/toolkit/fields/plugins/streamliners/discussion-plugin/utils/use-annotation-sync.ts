'use client';

import React from 'react';
import type { PlateEditor } from '@udecode/plate/react';

import { getCurrentAnnotations } from './tina-integration';

type UseAnnotationSyncHandlerArgs = {
  annotationsKey: string;
  editor: PlateEditor | null;
  syncAnnotationsToForm: () => void;
  isReadyForSync: React.MutableRefObject<boolean>;
};

/**
 * Returns a stable handler for AnnotationSync that only syncs when annotation
 * options actually change (avoids force-emitting editor changes that can
 * reset selection/caret).
 */
export const useAnnotationSyncHandler = ({
  annotationsKey,
  editor,
  syncAnnotationsToForm,
  isReadyForSync,
}: UseAnnotationSyncHandlerArgs) => {
  const lastAnnotationSyncHashRef = React.useRef<string | null>(null);

  return React.useCallback(() => {
    if (!isReadyForSync.current || !editor) return;

    const currentAnnotations = getCurrentAnnotations(editor);
    const currentHash = JSON.stringify(currentAnnotations);

    if (lastAnnotationSyncHashRef.current === currentHash) {
      return;
    }

    lastAnnotationSyncHashRef.current = currentHash;
    syncAnnotationsToForm();
  }, [annotationsKey, editor, syncAnnotationsToForm, isReadyForSync]);
};

