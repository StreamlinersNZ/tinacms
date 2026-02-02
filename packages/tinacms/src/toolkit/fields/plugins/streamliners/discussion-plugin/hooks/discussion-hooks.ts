import React from 'react';

import {
  ElementApi,
  PathApi,
  TextApi,
  type NodeEntry,
  type Path,
  type TElement,
} from '@udecode/plate';
import {
  useEditorPlugin,
  useEditorRef,
} from '@udecode/plate/react';
import type { TSuggestionText } from '@udecode/plate-suggestion';
import { SuggestionPlugin as SuggestionPluginType } from '@udecode/plate-suggestion/react';

import { commentPlugin } from '../plugins/comment-plugin';
import { suggestionPlugin } from '../../suggestion-plugin/suggestion-plugin';
import { getCommentIdsFromNode } from '../utils/annotation-util';
import type { StoredSuggestion } from '../utils/annotations-store';
import type { TCommentText } from '../components/comment-node';

export const useResolvedDiscussions = (
  commentNodes: NodeEntry<TCommentText>[],
  blockPath: Path
) => {
  const { api, getOption, setOption } = useEditorPlugin(commentPlugin);
  const threads = (getOption('threads') || {}) as Record<string, any>;
  const uniquePathMap = getOption('uniquePathMap');

  const blockPathKey = React.useMemo(() => blockPath.join('.'), [blockPath]);

  const pendingMap = React.useMemo(() => {
    let nextMap: Map<string, Path> | null = null;

    commentNodes.forEach(([node, nodePath]) => {
      const ids = getCommentIdsFromNode(node);

      ids.forEach((id) => {
        const previousPath = uniquePathMap.get(id);

        if (PathApi.isPath(previousPath)) {
          const nodes = api.comment.node({ id, at: previousPath });

          if (!nodes) {
            // Previous path is stale, claim it
            if (!nextMap) nextMap = new Map(uniquePathMap);
            nextMap.set(id, blockPath);
          } else {
            // Previous path is valid - attempt to claim if we're deeper (closer to the comment)
            // A deeper path has more segments, e.g., [0,1,1,13,0] is deeper than [0,1,1]
            // Final ownership is determined in useEffect with intelligent merging
            if (blockPath.length > previousPath.length) {
              if (!nextMap) nextMap = new Map(uniquePathMap);
              nextMap.set(id, blockPath);
            }
          }

          return;
        }

        // First time seeing this comment - claim it
        if (!nextMap) nextMap = new Map(uniquePathMap);
        nextMap.set(id, blockPath);
      });
    });

    return nextMap;
  }, [api.comment, blockPath, commentNodes, uniquePathMap, blockPathKey]);

  React.useEffect(() => {
    if (pendingMap) {
      const currentMap = getOption('uniquePathMap') as Map<string, Path>;
      const mergedMap = new Map(currentMap);
      let hasChanges = false;

      pendingMap.forEach((newPath, id) => {
        const currentPath = mergedMap.get(id);
        // Only update if new path is deeper (longer) than current owner, or no current owner exists
        if (!currentPath || newPath.length > currentPath.length) {
          mergedMap.set(id, newPath);
          hasChanges = true;
        }
      });

      if (hasChanges) {
        setOption('uniquePathMap', mergedMap);
      }
    }
  }, [pendingMap, setOption, getOption, blockPathKey]);

  const mapToUse = pendingMap ?? uniquePathMap;

  const commentIds = new Set(
    commentNodes
      .flatMap(([node]) => getCommentIdsFromNode(node))
      .filter((id): id is string => Boolean(id))
  );

  return Object.values(threads)
    .map((thread: any) => ({
      id: thread.id,
      comments: thread.messages || [],
      createdAt: new Date(thread.createdAt),
      updatedAt: thread.updatedAt ? new Date(thread.updatedAt) : undefined,
      isResolved: Boolean(thread.isResolved),
      userId: thread.messages?.[0]?.authorId ?? 'anonymous',
      documentContent: thread.documentContent,
      discussionSubject: thread.discussionSubject,
    }))
    .filter((discussion: any) => {
      const firstBlockPath = mapToUse.get(discussion.id);

      if (!firstBlockPath) return false;
      if (!PathApi.isPath(firstBlockPath)) return false;
      if (!PathApi.equals(firstBlockPath, blockPath)) return false;

      const pluginHasComment =
        typeof api.comment.has === 'function'
          ? api.comment.has({ id: discussion.id })
          : true;

      return (
        commentIds.has(discussion.id) &&
        !discussion.isResolved &&
        pluginHasComment
      );
    });
};

export const useResolvedSuggestions = (
  suggestionNodes: NodeEntry<TElement | TSuggestionText>[],
  blockPath: Path,
  suggestionMeta: Record<string, StoredSuggestion>
) => {
  const { api, getOption, setOption } = useEditorPlugin(suggestionPlugin);
  const uniquePathMap = getOption('uniquePathMap');

  const blockPathKey = React.useMemo(() => blockPath.join('.'), [blockPath]);

  const pendingMap = React.useMemo(() => {
    let nextMap: Map<string, Path> | null = null;

    suggestionNodes.forEach(([node]) => {
      const id = api.suggestion.nodeId(node);
      if (!id) return;

      const map = nextMap ?? uniquePathMap;
      const previousPath = map.get(id);

      if (PathApi.isPath(previousPath)) {
        const nodes = api.suggestion.node({
          id,
          at: previousPath,
          isText: true,
        });
        if (!nodes) {
          // Previous path is stale, claim it
          if (!nextMap) nextMap = new Map(uniquePathMap);
          nextMap.set(id, blockPath);
        } else {
          // Previous path is valid - attempt to claim if we're deeper (closer to the suggestion)
          // Final ownership is determined in useEffect with intelligent merging
          if (blockPath.length > previousPath.length) {
            if (!nextMap) nextMap = new Map(uniquePathMap);
            nextMap.set(id, blockPath);
          }
        }
        return;
      }

      // First time seeing this suggestion - claim it
      if (!nextMap) nextMap = new Map(uniquePathMap);
      nextMap.set(id, blockPath);
    });

    return nextMap;
  }, [api.suggestion, blockPath, suggestionNodes, uniquePathMap, blockPathKey]);

  React.useEffect(() => {
    if (pendingMap) {
      const currentMap = getOption('uniquePathMap') as Map<string, Path>;
      const mergedMap = new Map(currentMap);
      let hasChanges = false;

      pendingMap.forEach((newPath, id) => {
        const currentPath = mergedMap.get(id);
        // Only update if new path is deeper (longer) than current owner, or no current owner exists
        if (!currentPath || newPath.length > currentPath.length) {
          mergedMap.set(id, newPath);
          hasChanges = true;
        } 
      });

      if (hasChanges) {
        setOption('uniquePathMap', mergedMap);
      }
    }
  }, [pendingMap, setOption, getOption, blockPathKey]);

  const mapToUse = pendingMap ?? uniquePathMap;

  return React.useMemo(() => {
    if (suggestionNodes.length === 0) return [];

    const suggestionIds = new Set<string>();

    suggestionNodes.forEach(([node]) => {
      if (TextApi.isText(node)) {
        const dataList = api.suggestion.dataList(node);
        const updateEntries = dataList.filter((data) => data.type === 'update');

        if (updateEntries.length === 0) {
          const id = api.suggestion.nodeId(node);
          if (id) suggestionIds.add(id);
        } else {
          updateEntries.forEach((data) => {
            if (data.id) suggestionIds.add(data.id);
          });
        }
        return;
      }

      if (ElementApi.isElement(node)) {
        const id = api.suggestion.nodeId(node);
        if (id) suggestionIds.add(id);
      }
    });

    const resolved: Array<{
      suggestionId: string;
      createdAt: Date;
      userId?: string;
      status?: StoredSuggestion['status'];
    }> = [];

    suggestionIds.forEach((id) => {
      const path = mapToUse.get(id);
      if (!path || !PathApi.isPath(path)) return;
      if (!PathApi.equals(path, blockPath)) return;

      const meta = suggestionMeta[id];

      resolved.push({
        suggestionId: id,
        createdAt: meta?.createdAt ? new Date(meta.createdAt) : new Date(),
        userId: meta?.userId,
        status: meta?.status,
      });
    });

    return resolved;
  }, [api.suggestion, blockPath, mapToUse, suggestionMeta, suggestionNodes, blockPathKey]);
};

export const useAnnotationAnchor = (
  blockPath: Path,
  commentNodes: NodeEntry<TCommentText>[],
  suggestionNodes: NodeEntry<TElement | TSuggestionText>[],
  activeCommentId: string | null,
  activeSuggestionId: string | null
) => {
  const editor = useEditorRef();

  return React.useMemo(() => {
    let activeEntry: NodeEntry | undefined;

    if (activeSuggestionId) {
      activeEntry = suggestionNodes.find(([node]) => {
        if (!TextApi.isText(node)) return false;
        const suggestionId = editor
          .getApi(SuggestionPluginType)
          .suggestion.nodeId(node);
        return suggestionId === activeSuggestionId;
      });
    }

    if (activeCommentId) {
      activeEntry = commentNodes.find(([node]) =>
        getCommentIdsFromNode(node).includes(activeCommentId)
      );
    }

    const toDomNode = (entry?: NodeEntry) => {
      if (!entry) return null;
      try {
        return editor.api.toDOMNode(entry[0]);
      } catch {
        return null;
      }
    };

    const activeDom = toDomNode(activeEntry);
    if (activeDom) return activeDom;

    const blockEntry = editor.api.node(blockPath);
    return toDomNode(blockEntry ?? undefined);
  }, [
    activeCommentId,
    activeSuggestionId,
    commentNodes,
    editor,
    suggestionNodes,
    blockPath,
  ]);
};
