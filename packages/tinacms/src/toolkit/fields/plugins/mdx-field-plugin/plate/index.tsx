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
  saveAnnotations,
} from '../../streamliners/discussion-plugin/tina-integration';
import type { AnnotationState } from '../../streamliners/discussion-plugin/annotations-store';
import { normalizeAnnotations, createEmptyAnnotationState } from '../../streamliners/discussion-plugin/annotations-store';

const isAnnotationStateEmpty = (state: AnnotationState) =>
  Object.keys(state.comments).length === 0 &&
  Object.keys(state.suggestions).length === 0;

export const RichEditor = ({ input, tinaForm, field }: RichTextType) => {
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
  const annotationsRaw =
    typeof formValues?.annotations?.raw === 'string'
      ? formValues.annotations.raw
      : undefined;

  const globalAnnotationsMap = React.useMemo<
    Record<string, AnnotationState>
  >(() => {
    if (!annotationsRaw) return {};
    try {
      return JSON.parse(annotationsRaw) as Record<string, AnnotationState>;
    } catch {
      return {};
    }
  }, [annotationsRaw]);

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

  //TODO try with a wrapper?
  const editor = useCreateEditor({
    plugins: [...editorPlugins],
    value: initialValue,
    components: Components(),
  });

  const syncAnnotationsToForm = React.useCallback(() => {
    if (!tinaForm || !editor) return;

    // Get current annotations from plugin options
    const currentState = saveAnnotations(editor);

    const values =
      (tinaForm.values as Record<string, any> | undefined) ??
      tinaForm.finalForm?.getState().values;
    const raw =
      typeof values?.annotations?.raw === 'string'
        ? values.annotations.raw
        : undefined;
    let annotationsMap: Record<string, AnnotationState> = {};

    if (raw) {
      try {
        annotationsMap = JSON.parse(raw) as Record<string, AnnotationState>;
      } catch {
        annotationsMap = {};
      }
    }

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

      const hasEntries = Object.keys(nextAnnotations).length > 0;
      const serialized = hasEntries ? JSON.stringify(nextAnnotations) : undefined;
      console.log('[RichEditor] syncAnnotationsToForm', {
        annotationsKey,
        currentState,
        serialized: serialized?.substring(0, 200),
      });
      tinaForm.change('annotations.raw' as any, serialized);
    }
  }, [annotationsKey, tinaForm, editor]);

  const lastEmissionRef = React.useRef<{
    childrenHash: string;
    annotationsHash: string;
  } | null>(null);

  const emitChange = React.useCallback(
    (children: any[]) => {
      if (!editor) return;

      const normalized = children.map(normalizeLinksInCodeBlocks);
      const childrenHash = JSON.stringify(normalized);

      // Get annotations from plugin options
      const currentAnnotations = saveAnnotations(editor);
      const annotationsHash = JSON.stringify(currentAnnotations);

      const last = lastEmissionRef.current;
      if (
        last &&
        last.childrenHash === childrenHash &&
        last.annotationsHash === annotationsHash
      ) {
        return;
      }
      lastEmissionRef.current = { childrenHash, annotationsHash };
      input.onChange({
        type: 'root',
        children: normalized,
      });
      syncAnnotationsToForm();
    },
    [input, syncAnnotationsToForm, editor]
  );

  // Load annotations into plugin options on mount
  React.useEffect(() => {
    if (!editor || !initialAnnotationsRef.current) return;
    loadAnnotations(editor, initialAnnotationsRef.current);
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
  return (
    <div ref={ref}>
      <Plate
        editor={editor}
        onChange={(value) => {
          emitChange(value.value as any[]);
        }}
      >
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
