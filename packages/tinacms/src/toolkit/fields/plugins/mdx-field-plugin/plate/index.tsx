import React from 'react';
import { Components } from './plugins/ui/components';
import { helpers, normalizeLinksInCodeBlocks } from './plugins/core/common';
import type { RichTextType } from '..';
import { Editor, EditorContainer } from './components/editor';
import { FixedToolbar } from './components/plate-ui/fixed-toolbar';
import { TooltipProvider } from './components/plate-ui/tooltip';
import FixedToolbarButtons from './components/fixed-toolbar-buttons';
import { ToolbarProvider } from './toolbar/toolbar-provider';
import { Plate } from '@udecode/plate/react';
import { useCreateEditor } from './hooks/use-create-editor';
import { editorPlugins } from './plugins/editor-plugins';
import { FloatingToolbar } from './components/plate-ui/floating-toolbar';
import FloatingToolbarButtons from './components/floating-toolbar-buttons';
import {
  loadAnnotations,
  getCurrentAnnotations,
  annotationsFieldToMap,
  annotationMapToEntries,
  areAnnotationEntriesEqual,
} from '../../streamliners/discussion-plugin/utils/tina-integration';
import type { TinaAnnotationsFieldValue } from '../../streamliners/discussion-plugin/utils/tina-integration';
import type { AnnotationState } from '../../streamliners/discussion-plugin/utils/annotations-store';
import { normalizeAnnotations, createEmptyAnnotationState } from '../../streamliners/discussion-plugin/utils/annotations-store';
import { suggestionPlugin } from '../../streamliners/suggestion-plugin/suggestion-plugin';
import { useRegisterAnnotationsField } from '../../streamliners/discussion-plugin/utils/final-form-bridge';
import { annotateSuggestionsWithUserName } from '../../streamliners/suggestion-plugin/utils/annotate-suggestions';
import { AnnotationSync } from '../../streamliners/discussion-plugin/utils/annotation-sync';
import { useAnnotationSyncHandler } from '../../streamliners/discussion-plugin/utils/use-annotation-sync';
import { PlateEditor } from '@udecode/plate/react';

const isAnnotationStateEmpty = (state: AnnotationState) =>
  Object.keys(state.comments).length === 0 &&
  Object.keys(state.suggestions).length === 0;

export const RichEditor = ({ input, tinaForm, field }: RichTextType) => {
  // Ensure annotations are registered with Final Form so annotation-only edits mark the form dirty
  useRegisterAnnotationsField(tinaForm);

  const isReadyForSync = React.useRef(false);

  const annotationsKey = React.useMemo(
    () => input.name ?? field.name ?? 'rich-text',
    [input.name, field.name]
  );

  const initialValue = React.useMemo(() => {
    if (field?.parser?.type === 'slatejson') {
      return input.value.children;
    } else if (input.value?.children?.length) {
      const normalized = input.value.children.map(helpers.normalize);
      return normalized;
    } else {
      return [{ type: 'p', children: [{ type: 'text', text: '' }] }];
    }
  }, []);

  const initialAnnotationsRef = React.useRef<AnnotationState | null>(null);
  const formValues =
    (tinaForm?.values as Record<string, any> | undefined) ??
    tinaForm?.finalForm?.getState().values;
  const annotationsFieldValue =
    (formValues?.annotations as TinaAnnotationsFieldValue | undefined) ??
    undefined;
  const annotationsEntries = Array.isArray(annotationsFieldValue?.entries)
    ? annotationsFieldValue.entries
    : undefined;

  const globalAnnotationsMap = React.useMemo<
    Record<string, AnnotationState>
  >(() => {
    return annotationsFieldToMap(annotationsEntries);
  }, [annotationsEntries]);

  const existingFieldAnnotations = globalAnnotationsMap[annotationsKey];
  const legacyFieldAnnotations = input.value
    ?.annotations as AnnotationState | undefined;

  if (!initialAnnotationsRef.current) {
    const sourceAnnotations =
      existingFieldAnnotations ?? legacyFieldAnnotations;

    initialAnnotationsRef.current = sourceAnnotations
      ? normalizeAnnotations(sourceAnnotations)
      : createEmptyAnnotationState();
  }

  // No longer need React state - annotations live in plugin options

  // Memoize component map so Plate children aren't recreated every render
  const components = React.useMemo(() => Components(), []);

  const editor = useCreateEditor({
    plugins: editorPlugins,
    value: initialValue,
    components,
  }) as PlateEditor;

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

    const currentIsEmpty = isAnnotationStateEmpty(currentState);

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
        console.log('[RichEditor] syncAnnotationsToForm', {
          annotationsKey,
          entryCount: nextEntries.length,
        });
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
    [input, syncAnnotationsToForm, editor, annotationsKey]
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
  // This should be a plugin customization
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (ref.current) {
      setTimeout(() => {
        // Slate/Plate doesn't expose it's underlying element
        // as a ref, so we need to query for it ourselves
        const plateElement = ref.current?.querySelector(
          '[role="textbox"]'
        ) as HTMLElement;
        if (field.experimental_focusIntent && plateElement) {
          if (plateElement) plateElement.focus();
        }
        // Slate takes a second to mount
      }, 100);
    }
  }, [field.experimental_focusIntent, ref]);
  //
  const handleAnnotationSync = useAnnotationSyncHandler({
    annotationsKey,
    editor,
    syncAnnotationsToForm,
    isReadyForSync,
  });

  return (
    <div ref={ref}>
      <Plate
        editor={editor}
        onChange={(value) => {
          emitChange(value.value as any[]);
        }}
      >
        <AnnotationSync
          onSync={handleAnnotationSync}
        />
        <EditorContainer>
          <TooltipProvider>
          <ToolbarProvider
            tinaForm={tinaForm}
            templates={field.templates}
            overrides={
              field?.toolbarOverride ? field.toolbarOverride : field.overrides
            }
          >
            <FixedToolbar>
              <FixedToolbarButtons />
            </FixedToolbar>
            {field?.overrides?.showFloatingToolbar !== false ? (
              <FloatingToolbar>
                <FloatingToolbarButtons />
              </FloatingToolbar>
            ) : null}
          </ToolbarProvider>
          <Editor />
          </TooltipProvider>
        </EditorContainer>
      </Plate>
    </div>
  );
};
