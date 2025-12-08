import React from 'react';
import type { PlateEditor } from '@udecode/plate/react';
import { useRegisterAnnotationsField } from '../utils/final-form-bridge';
import {
  loadAnnotations,
  getCurrentAnnotations,
  annotationsFieldToMap,
  annotationMapToEntries,
  areAnnotationEntriesEqual,
  type TinaAnnotationsFieldValue,
} from '../utils/tina-integration';
import {
  normalizeAnnotations,
  createEmptyAnnotationState,
  type AnnotationState,
} from '../utils/annotations-store';
import { useAnnotationSyncHandler } from '../utils/use-annotation-sync';
import { AnnotationSync } from '../utils/annotation-sync';
import { suggestionPlugin } from '../../suggestion-plugin/suggestion-plugin';
import { annotateSuggestionsWithUserName } from '../../suggestion-plugin/utils/annotate-suggestions';

interface UseTinaDiscussionProps {
  tinaForm: any;
  editor: PlateEditor;
  input: any;
  field: any;
  normalizeLinksInCodeBlocks: (node: any) => any;
}

export const useTinaDiscussion = ({
  tinaForm,
  editor,
  input,
  field,
  normalizeLinksInCodeBlocks,
}: UseTinaDiscussionProps) => {
  // Ensure annotations are registered with Final Form so annotation-only edits mark the form dirty
  useRegisterAnnotationsField(tinaForm);

  const isReadyForSync = React.useRef(false);

  const annotationsKey = React.useMemo(
    () => input.name ?? field.name ?? 'rich-text',
    [input.name, field.name]
  );

  const initialAnnotationsRef = React.useRef<AnnotationState | null>(null);

  // Initialize annotations ref if needed
  if (!initialAnnotationsRef.current) {
    const formValues =
      (tinaForm?.values as Record<string, any> | undefined) ??
      tinaForm?.finalForm?.getState().values;
    const annotationsFieldValue =
      (formValues?.annotations as TinaAnnotationsFieldValue | undefined) ??
      undefined;
    const annotationsEntries = Array.isArray(annotationsFieldValue?.entries)
      ? annotationsFieldValue.entries
      : undefined;

    const globalAnnotationsMap = annotationsFieldToMap(annotationsEntries);

    const existingFieldAnnotations = globalAnnotationsMap[annotationsKey];
    const legacyFieldAnnotations = input.value?.annotations as AnnotationState | undefined;

    const sourceAnnotations = existingFieldAnnotations ?? legacyFieldAnnotations;

    initialAnnotationsRef.current = sourceAnnotations
      ? normalizeAnnotations(sourceAnnotations)
      : createEmptyAnnotationState();
  }

  const syncAnnotationsToForm = React.useCallback(() => {
    if (!tinaForm || !editor) return;

    // Get current annotations from plugin options without triggering debug logging
    const currentState = getCurrentAnnotations(editor);

    const values =
      (tinaForm.values as Record<string, any> | undefined) ??
      tinaForm.finalForm?.getState().values;
    const annotationsValue =
      (values?.annotations as TinaAnnotationsFieldValue | undefined) ??
      undefined;
    const currentEntries = Array.isArray(annotationsValue?.entries)
      ? annotationsValue.entries
      : undefined;
    let annotationsMap = annotationsFieldToMap(currentEntries);

    const currentIsEmpty =
      Object.keys(currentState.comments).length === 0 &&
      Object.keys(currentState.suggestions).length === 0;

    if (!currentIsEmpty || annotationsMap[annotationsKey]) {
      const nextAnnotations: Record<string, AnnotationState> = {
        ...annotationsMap,
      };

      if (currentIsEmpty) {
        delete nextAnnotations[annotationsKey];
      } else {
        nextAnnotations[annotationsKey] = currentState;
      }

      const nextEntries = annotationMapToEntries(nextAnnotations);
      const normalizedEntries =
        nextEntries.length > 0 ? nextEntries : undefined;

      if (!areAnnotationEntriesEqual(currentEntries, normalizedEntries)) {
        tinaForm.change('annotations.entries' as any, normalizedEntries);
      }
    }
  }, [annotationsKey, tinaForm, editor]);

  const lastEmissionRef = React.useRef<{
    childrenHash: string;
    annotationsHash: string;
  } | null>(null);

  const emitChange = React.useCallback(
    (children: any[], force: boolean = false) => {
      if (!editor) return;

      const normalized = children.map(normalizeLinksInCodeBlocks);
      const userName = editor.getOption(suggestionPlugin, 'currentUserName');
      const normalizedWithNames = annotateSuggestionsWithUserName(
        normalized,
        userName
      );
      const childrenHash = JSON.stringify(normalizedWithNames);

      // Get annotations from plugin options
      const currentAnnotations = getCurrentAnnotations(editor);
      const annotationsHash = JSON.stringify(currentAnnotations);

      const last = lastEmissionRef.current;
      if (
        !force &&
        last &&
        last.childrenHash === childrenHash &&
        last.annotationsHash === annotationsHash
      ) {
        return;
      }
      lastEmissionRef.current = { childrenHash, annotationsHash };
      input.onChange({
        type: 'root',
        children: normalizedWithNames,
      });
      syncAnnotationsToForm();
    },
    [input, syncAnnotationsToForm, editor, annotationsKey, normalizeLinksInCodeBlocks]
  );

  // Load annotations into plugin options on mount
  React.useEffect(() => {
    if (!editor || !initialAnnotationsRef.current) return;
    loadAnnotations(editor, initialAnnotationsRef.current);
    // Ensure we don't trigger the dirty flag too early.
    setTimeout(() => {
      isReadyForSync.current = true;
    }, 0);
  }, [editor]);

  // Trigger initial emit when editor is ready
  React.useEffect(() => {
    if (!editor) return;
    emitChange(editor.children as any[]);
  }, [editor, emitChange]);

  const handleAnnotationSync = useAnnotationSyncHandler({
    annotationsKey,
    editor,
    syncAnnotationsToForm,
    isReadyForSync,
  });

  const onChange = React.useCallback((value: { value: any[] }) => {
    emitChange(value.value);
  }, [emitChange]);

  const SyncComponent = React.useMemo(() => () => (
    <AnnotationSync onSync={handleAnnotationSync} />
  ), [handleAnnotationSync]);

  return {
    onChange,
    SyncComponent,
  };
};
