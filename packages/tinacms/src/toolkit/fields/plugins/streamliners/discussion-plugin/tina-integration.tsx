'use client';

import React from 'react';
import { PlateEditor } from '@udecode/plate/react';

import { commentPlugin, type CommentThread } from './comment-plugin';
import { suggestionPlugin } from '../suggestion-plugin/suggestion-plugin';
import type { StoredSuggestion } from './annotations-store';

/**
 * Load annotations from TinaCMS form data into Plate plugin options
 * This happens once when the editor mounts
 */
export function loadAnnotations(
  editor: PlateEditor,
  annotationsRaw?: {
    comments?: Record<string, CommentThread>;
    suggestions?: Record<string, StoredSuggestion>;
  }
) {
  if (!annotationsRaw) return;

  const comments = annotationsRaw.comments || {};
  const suggestions = annotationsRaw.suggestions || {};

  // Load comment threads into plugin options (single source of truth)
  editor.setOption(commentPlugin, 'threads', comments);

  // Load suggestion metadata into plugin options
  editor.setOption(suggestionPlugin, 'metadata', suggestions);

  if (process.env.NODE_ENV !== 'production') {
    console.debug('[TinaIntegration] Loaded annotations:', {
      commentCount: Object.keys(comments).length,
      suggestionCount: Object.keys(suggestions).length,
    });
  }
}

/**
 * Save annotations from Plate plugin options back to TinaCMS form data
 * This happens when the form is saved
 */
export function saveAnnotations(editor: PlateEditor): {
  comments: Record<string, CommentThread>;
  suggestions: Record<string, StoredSuggestion>;
} {
  const threads = (editor.getOption(commentPlugin, 'threads') ||
    {}) as Record<string, CommentThread>;
  const metadata = (editor.getOption(suggestionPlugin, 'metadata') ||
    {}) as Record<string, StoredSuggestion>;

  if (process.env.NODE_ENV !== 'production') {
    console.debug('[TinaIntegration] Saving annotations:', {
      commentCount: Object.keys(threads).length,
      suggestionCount: Object.keys(metadata).length,
    });
  }

  return {
    comments: threads,
    suggestions: metadata,
  };
}

/**
 * Hook to integrate annotations with TinaCMS form lifecycle
 * Handles loading annotations on mount and saving on form submit
 */
export function useAnnotationIntegration(
  editor: PlateEditor,
  initialAnnotations?: {
    comments?: Record<string, CommentThread>;
    suggestions?: Record<string, StoredSuggestion>;
  }
) {
  const hasLoadedRef = React.useRef(false);

  // Load annotations once on mount
  React.useEffect(() => {
    if (!hasLoadedRef.current && initialAnnotations) {
      loadAnnotations(editor, initialAnnotations);
      hasLoadedRef.current = true;
    }
  }, [editor, initialAnnotations]);

  // Return save function for form to call on submit
  return React.useCallback(() => {
    return saveAnnotations(editor);
  }, [editor]);
}

/**
 * Get current annotations from editor (for reading without saving)
 */
export function getCurrentAnnotations(editor: PlateEditor): {
  comments: Record<string, CommentThread>;
  suggestions: Record<string, StoredSuggestion>;
} {
  return {
    comments: (editor.getOption(commentPlugin, 'threads') ||
      {}) as Record<string, CommentThread>,
    suggestions: (editor.getOption(suggestionPlugin, 'metadata') ||
      {}) as Record<string, StoredSuggestion>,
  };
}
