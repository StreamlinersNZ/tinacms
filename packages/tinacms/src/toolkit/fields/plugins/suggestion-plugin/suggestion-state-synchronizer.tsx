'use client';

import React from 'react';

import { TextApi } from '@udecode/plate';
import type { PlateEditor } from '@udecode/plate/react';
import { useEditorPlugin } from '@udecode/plate/react';

import { suggestionPlugin } from './suggestion-plugin';
import { useAnnotationsStore } from '../discussion-plugin/annotations-store';
import { areSuggestionMapsEqual } from '../discussion-plugin/annotations-store';
import type { StoredSuggestion } from '../discussion-plugin/annotations-store';

const SUGGESTION_PREFIX = 'suggestion_';

const extractSuggestionRecords = (
  editor: PlateEditor,
  existing: Record<string, StoredSuggestion>
) => {
  const records: Record<string, StoredSuggestion> = {};
  let hasStructuredData = false;
  const entries = editor.api.nodes({
    at: [],
    match: (node: any) => TextApi.isText(node) && !!node.suggestion,
    mode: 'all',
  });

  for (const [node] of entries) {
    Object.entries(node).forEach(([key, value]) => {
      if (!key.startsWith(SUGGESTION_PREFIX)) return;
      const id = key.slice(SUGGESTION_PREFIX.length);
      if (!id) return;
      if (typeof value !== 'object' || value === null) {
        const fallback = existing[id];
        if (fallback) {
          records[id] = fallback;
        }
        return;
      }

      hasStructuredData = true;
      const storedValue = value as StoredSuggestion;
      records[id] = {
        id,
        createdAt: storedValue.createdAt,
        type: storedValue.type,
        userId: storedValue.userId,
        status: storedValue.status,
        resolvedAt: storedValue.resolvedAt,
      };
    });
  }

  if (!hasStructuredData) {
    return existing;
  }

  return records;
};

export function SuggestionStateSynchronizer() {
  const { editor } = useEditorPlugin(suggestionPlugin);
  const { annotations, setSuggestions } = useAnnotationsStore();

  React.useEffect(() => {
    const derived = extractSuggestionRecords(editor, annotations.suggestions);
    if (!areSuggestionMapsEqual(annotations.suggestions, derived)) {
      setSuggestions(derived);
    }
  }, [editor, annotations.suggestions, setSuggestions, editor.children]);

  return null;
}
