'use client';

import React from 'react';
import { ElementApi, TextApi, type Path, type TElement } from '@udecode/plate';
import { PlateEditor } from '@udecode/plate/react';
import type { TSuggestionText } from '@udecode/plate-suggestion';
import { SuggestionPlugin } from '@udecode/plate-suggestion/react';

import { commentPlugin, type CommentThread } from '../plugins/comment-plugin';
import { suggestionPlugin } from '../../suggestion-plugin/suggestion-plugin';
import type { StoredSuggestion } from './annotations-store';
import {
  type AnnotationState,
  normalizeAnnotations,
} from './annotations-store';
import { getCommentIdsFromNode } from './annotation-util';

type AnnotationEntry = {
  path: string;
  comments?: CommentThread[] | null;
  suggestions?: StoredSuggestion[] | null;
};

export type TinaAnnotationsFieldValue = {
  entries?: AnnotationEntry[] | null;
};

const listToRecord = <T extends { id?: string }>(
  list: T[] | null | undefined,
  fallbackPrefix: string
): Record<string, T> => {
  if (!list?.length) return {};
  return list.reduce<Record<string, T>>((acc, item, index) => {
    if (!item) return acc;
    const id = item.id ?? `${fallbackPrefix}-${index}`;
    acc[id] = { ...item, id };
    return acc;
  }, {});
};

export const annotationsFieldToMap = (
  entries: AnnotationEntry[] | null | undefined
): Record<string, AnnotationState> => {
  if (!Array.isArray(entries)) return {};

  return entries.reduce<Record<string, AnnotationState>>((acc, entry) => {
    if (!entry?.path) return acc;
    const state = normalizeAnnotations({
      comments: listToRecord(entry.comments, `${entry.path}-comment`),
      suggestions: listToRecord(entry.suggestions, `${entry.path}-suggestion`),
    });

    const hasData =
      Object.keys(state.comments).length > 0 ||
      Object.keys(state.suggestions).length > 0;

    if (!hasData) return acc;

    acc[entry.path] = state;
    return acc;
  }, {});
};

export const annotationMapToEntries = (
  map: Record<string, AnnotationState>
): AnnotationEntry[] => {
  return Object.entries(map)
    .map(([path, state]) => {
      if (!state) return null;

      const comments = Object.values(state.comments ?? {});
      const suggestions = Object.values(state.suggestions ?? {});

      if (!comments.length && !suggestions.length) return null;

      return {
        path,
        comments,
        suggestions,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.path.localeCompare(b.path));
};

export const areAnnotationEntriesEqual = (
  a?: AnnotationEntry[] | null,
  b?: AnnotationEntry[] | null
) => {
  if (a === b) return true;
  const aString = JSON.stringify(a ?? []);
  const bString = JSON.stringify(b ?? []);
  return aString === bString;
};

/**
 * Build uniquePathMap by scanning editor content for all annotations
 * Maps each annotation ID to the deepest block path that contains it
 */
function buildUniquePathMap(editor: PlateEditor): Map<string, Path> {
  const uniquePathMap = new Map<string, Path>();
  const suggestionApi = editor.getApi(SuggestionPlugin);

  // Iterate through all text nodes to find comment marks and suggestion marks
  const textNodes = editor.api.nodes({
    at: [],
    match: (node) => TextApi.isText(node),
  });

  for (const [node, nodePath] of textNodes) {
    const annotationIds: string[] = [];

    // Extract comment IDs from text node
    const commentIds = getCommentIdsFromNode(node);
    annotationIds.push(...commentIds);

    // Extract suggestion ID from text node if it exists
    // Type assertion: we know from the filter that this is a text node
    if (TextApi.isText(node)) {
      const suggestionId = suggestionApi.suggestion.nodeId(node as TSuggestionText);
      if (suggestionId) {
        annotationIds.push(suggestionId);
      }
    }

    if (annotationIds.length === 0) continue;

    // Find the parent block element for this text node
    const blockPath = findParentBlockPath(editor, nodePath);
    if (!blockPath) continue;

    // For each annotation, update the map if this block is deeper
    annotationIds.forEach((id) => {
      const currentPath = uniquePathMap.get(id);
      if (!currentPath || blockPath.length > currentPath.length) {
        uniquePathMap.set(id, blockPath);
      }
    });
  }

  // Also check element nodes for suggestions (they can be on block-level elements)
  const elementNodes = editor.api.nodes({
    at: [],
    match: (node) => ElementApi.isElement(node),
  });

  for (const [node, nodePath] of elementNodes) {
    // Type assertion: we know from the filter that this is an element node
    if (ElementApi.isElement(node)) {
      const suggestionId = suggestionApi.suggestion.nodeId(node as TElement);
      if (!suggestionId) continue;

      // For element nodes, the blockPath is the node itself
      const blockPath = nodePath;
      const currentPath = uniquePathMap.get(suggestionId);

      if (!currentPath || blockPath.length > currentPath.length) {
        uniquePathMap.set(suggestionId, blockPath);
      }
    }
  }

  return uniquePathMap;
}

/**
 * Find the parent block element path for a given node path
 * A block is an element node (not text) that can contain content
 */
function findParentBlockPath(editor: PlateEditor, nodePath: Path): Path | null {
  // Walk up the tree to find the first element node
  for (let i = nodePath.length - 1; i >= 0; i--) {
    const ancestorPath = nodePath.slice(0, i);
    const [ancestorNode] = editor.api.node(ancestorPath) || [];

    if (ancestorNode && ElementApi.isElement(ancestorNode)) {
      return ancestorPath;
    }
  }

  return null;
}

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

  // Build and load uniquePathMap to prevent flash on initial render
  const uniquePathMap = buildUniquePathMap(editor);
  editor.setOption(commentPlugin, 'uniquePathMap', uniquePathMap);
  editor.setOption(suggestionPlugin, 'uniquePathMap', uniquePathMap);

  console.log('[loadAnnotations] Initialized uniquePathMap with', uniquePathMap.size, 'annotations:',
    Array.from(uniquePathMap.entries()).map(([id, path]) => ({ id, path: path.join('.') }))
  );
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
