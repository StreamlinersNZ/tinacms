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
import { CommentStateSynchronizer } from '../../discussion-plugin/comment-state-synchronizer';
import { SuggestionStateSynchronizer } from '../../suggestion-plugin/suggestion-state-synchronizer';
import {
  AnnotationsProvider,
  createEmptyAnnotationState,
  normalizeAnnotations,
  areAnnotationStatesEqual,
  areSuggestionMapsEqual,
  type AnnotationState,
  type CommentsUpdater,
  type SuggestionsUpdater,
} from '../../discussion-plugin/annotations-store';
import { areCommentMapsEqual } from '../../discussion-plugin/comment-annotations';
import { AnnotationPluginBridge } from '../../discussion-plugin/annotation-plugin-bridge';
import { DiscussionPluginBridge } from '../../discussion-plugin/discussion-plugin-bridge';
import { DiscussionUserSynchronizer } from '../../discussion-plugin/discussion-user-synchronizer';

export const RichEditor = ({ input, tinaForm, field }: RichTextType) => {
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
  if (!initialAnnotationsRef.current) {
    if (input.value?.annotations) {
      initialAnnotationsRef.current = normalizeAnnotations(
        input.value.annotations as AnnotationState
      );
    } else {
      initialAnnotationsRef.current = createEmptyAnnotationState();
    }
  }

  const [annotations, setAnnotations] = React.useState<AnnotationState>(
    initialAnnotationsRef.current
  );

  const setComments = React.useCallback(
    (updater: CommentsUpdater) => {
      setAnnotations((previous) => {
        const nextComments =
          typeof updater === 'function'
            ? updater(previous.comments)
            : updater;
        if (
          previous.comments === nextComments ||
          areCommentMapsEqual(previous.comments, nextComments)
        ) {
          return previous;
        }
        return {
          ...previous,
          comments: nextComments,
        };
      });
    },
    []
  );

  const setSuggestions = React.useCallback(
    (updater: SuggestionsUpdater) => {
      setAnnotations((previous) => {
        const nextSuggestions =
          typeof updater === 'function'
            ? updater(previous.suggestions)
            : updater;
        if (
          previous.suggestions === nextSuggestions ||
          areSuggestionMapsEqual(previous.suggestions, nextSuggestions)
        ) {
          return previous;
        }
        return {
          ...previous,
          suggestions: nextSuggestions,
        };
      });
    },
    []
  );

  const annotationsRef = React.useRef(annotations);
  React.useEffect(() => {
    annotationsRef.current = annotations;
  }, [annotations]);

  const lastEmissionRef = React.useRef<{
    childrenHash: string;
    annotationsHash: string;
  } | null>(null);

  const emitChange = React.useCallback(
    (children: any[]) => {
      const normalized = children.map(normalizeLinksInCodeBlocks);
      const childrenHash = JSON.stringify(normalized);
      const annotationsHash = JSON.stringify(annotationsRef.current);
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
        annotations: annotationsRef.current,
      });
    },
    [input]
  );

  //TODO try with a wrapper?
  const editor = useCreateEditor({
    plugins: [...editorPlugins],
    value: initialValue,
    components: Components(),
  });

  React.useEffect(() => {
    if (!editor) return;
    emitChange(editor.children as any[]);
  }, [annotations, editor, emitChange]);
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
      <AnnotationsProvider
        value={{ annotations, setComments, setSuggestions }}
      >
        <Plate
          editor={editor}
          onChange={(value) => {
            emitChange(value.value as any[]);
          }}
        >
          <DiscussionPluginBridge />
          <DiscussionUserSynchronizer />
          <AnnotationPluginBridge />
          <CommentStateSynchronizer />
          <SuggestionStateSynchronizer />
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
      </AnnotationsProvider>
    </div>
  );
};
