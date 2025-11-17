'use client';

import React from 'react';

import {
  type AnyPluginConfig,
  ElementApi,
  type NodeEntry,
  type Path,
  PathApi,
  type TElement,
  TextApi,
} from '@udecode/plate';
import { CommentsPlugin } from '@udecode/plate-comments/react';
import {
  PlateElementProps,
  RenderNodeWrapper,
  useEditorPlugin,
  useEditorRef,
  usePluginOption,
} from '@udecode/plate/react';
import type { TSuggestionText } from '@udecode/plate-suggestion';
import { SuggestionPlugin as SuggestionPluginType } from '@udecode/plate-suggestion/react';
import {
  MessageSquareTextIcon,
  MessagesSquareIcon,
  PencilLineIcon,
} from 'lucide-react';

import { Button } from '../../mdx-field-plugin/plate/components/plate-ui/button';
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from '../../mdx-field-plugin/plate/components/plate-ui/popover';
import { suggestionPlugin } from '../suggestion-plugin/suggestion-plugin';
import { commentPlugin } from './comment-plugin';
import { getCommentIdsFromNode } from './comment-ids';
import { type StoredSuggestion } from './annotations-store';
import { BlockThreadView } from './BlockThreadView';
import type { TCommentText } from './comment-node';
import type { TDiscussion } from './types';
import { useCMS } from '@toolkit/react-core';

type ResolvedSuggestion = {
  suggestionId: string;
  createdAt: Date;
  userId?: string;
  status?: StoredSuggestion['status'];
};

const isResolvedSuggestion = (
  item: TDiscussion | ResolvedSuggestion
): item is ResolvedSuggestion => 'suggestionId' in item;

const isDevEnv = process.env.NODE_ENV !== 'production';

export const BlockDiscussion: RenderNodeWrapper<AnyPluginConfig> = (props) => {
  const { editor, element } = props;
  const commentsApi = editor.getApi(CommentsPlugin).comment;
  const blockPath = editor.api.findPath(element);

  if (!blockPath) return;

  const commentNodes = [
    ...commentsApi.nodes({ at: blockPath }),
  ] as NodeEntry<TCommentText>[];
  const suggestionNodes = [
    ...editor.getApi(SuggestionPluginType).suggestion.nodes({ at: blockPath }),
  ];

  if (commentNodes.length === 0 && suggestionNodes.length === 0) {
    return null;
  }

  return (props) => (
    <BlockDiscussionContent
      blockPath={blockPath}
      commentNodes={commentNodes}
      suggestionNodes={suggestionNodes}
      {...props}
    />
  );
};

const BlockDiscussionContent = ({
  blockPath,
  children,
  commentNodes,
  suggestionNodes,
}: PlateElementProps & {
  blockPath: Path;
  commentNodes: NodeEntry<TCommentText>[];
  suggestionNodes: NodeEntry<TElement | TSuggestionText>[];
}) => {
  const editor = useEditorRef();

  // Get data directly from plugin options (single source of truth)
  const commentThreads = (editor.getOption(commentPlugin, 'threads') || {}) as Record<string, any>;
  const suggestionMetadata = (editor.getOption(suggestionPlugin, 'metadata') || {}) as Record<string, StoredSuggestion>;

  const resolvedSuggestions = useResolvedSuggestions(
    suggestionNodes,
    blockPath,
    suggestionMetadata
  );
  const resolvedDiscussions = useResolvedDiscussions(commentNodes, blockPath);

  const suggestionsCount = resolvedSuggestions.length;
  const discussionsCount = resolvedDiscussions.length;
  const totalCount = suggestionsCount + discussionsCount;

  const { setOption: setCommentOption } = useEditorPlugin(commentPlugin);
  const { setOption: setSuggestionOption } = useEditorPlugin(suggestionPlugin);
  const blockPathKey = React.useMemo(() => blockPath.join('.'), [blockPath]);
  const activeCommentId = usePluginOption(commentPlugin, 'activeId');
  const activeSuggestionId = usePluginOption(suggestionPlugin, 'activeId');

  const activeSuggestion = activeSuggestionId
    ? resolvedSuggestions.find(
        (suggestion) => suggestion.suggestionId === activeSuggestionId
      )
    : undefined;

  const activeDiscussion = activeCommentId
    ? resolvedDiscussions.find((discussion) => discussion.id === activeCommentId)
    : undefined;

  const noneActive = !activeSuggestion && !activeDiscussion;

  const sortedMergedData = React.useMemo<
    Array<TDiscussion | ResolvedSuggestion>
  >(
    () =>
      [...resolvedDiscussions, ...resolvedSuggestions].sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      ),
    [resolvedDiscussions, resolvedSuggestions]
  );

  const selected =
    resolvedDiscussions.some((discussion) => discussion.id === activeCommentId) ||
    resolvedSuggestions.some(
      (suggestion) => suggestion.suggestionId === activeSuggestionId
    );

  const [internalOpen, setInternalOpen] = React.useState<boolean>(false);
  const [forceListView, setForceListView] = React.useState(false);
  const pendingCloseRef = React.useRef(false);
  const pendingCloseHandleRef = React.useRef<number | null>(null);
  const annotationActive =
    Boolean(activeCommentId) || Boolean(activeSuggestionId);
  const allowAutoOpen = selected;
  const open = annotationActive ? false : internalOpen || allowAutoOpen;

  const closePopover = React.useCallback(
    (options?: { preserveState?: boolean }) => {
      const preserveState = Boolean(options?.preserveState);

      setInternalOpen(false);
      setForceListView(false);

      if (!preserveState) {
        setCommentOption('activeId', null);
        setSuggestionOption('activeId', null);
      }

      if (isDevEnv) {
        console.debug('[BlockDiscussion] popover closed', {
          blockPath: blockPathKey,
          preserveState,
        });
      }
    },
    [
      blockPathKey,
      setCommentOption,
      setSuggestionOption,
    ]
  );

  const showAllThreads = forceListView || noneActive;
  const prevOpenRef = React.useRef(open);

  React.useEffect(() => {
    if (!isDevEnv) return;
    if (prevOpenRef.current !== open) {
      console.debug('[BlockDiscussion] popover open change', {
        blockPath: blockPathKey,
        prev: prevOpenRef.current,
        next: open,
        internalOpen,
        selected,
      });
      prevOpenRef.current = open;
    }
  }, [open, blockPathKey, internalOpen, selected]);

  React.useEffect(() => {
    if (forceListView && (activeCommentId || activeSuggestionId)) {
      setForceListView(false);
    }
  }, [forceListView, activeCommentId, activeSuggestionId]);

  React.useEffect(() => {
    return () => {
      if (pendingCloseHandleRef.current !== null) {
        cancelAnimationFrame(pendingCloseHandleRef.current);
        pendingCloseHandleRef.current = null;
      }
      pendingCloseRef.current = false;
    };
  }, []);


  const anchorElement = React.useMemo(() => {
    let activeEntry: NodeEntry | undefined;

    if (activeSuggestion) {
      activeEntry = suggestionNodes.find(([node]) => {
        if (!TextApi.isText(node)) return false;
        const suggestionId = editor
          .getApi(SuggestionPluginType)
          .suggestion.nodeId(node);
        return suggestionId === activeSuggestion.suggestionId;
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
    activeSuggestion,
    commentNodes,
    editor,
    suggestionNodes,
    blockPath,
  ]);

  if (totalCount === 0) {
    return <div className="w-full">{children}</div>;
  }

  return (
    <div className="w-full">
      <Popover
        open={open}
        onOpenChange={(next) => {
          if (annotationActive) {
            if (!next && internalOpen) {
              setInternalOpen(false);
            }
            return;
          }

          if (next) {
            setInternalOpen(true);
            pendingCloseRef.current = false;
            if (pendingCloseHandleRef.current !== null) {
              cancelAnimationFrame(pendingCloseHandleRef.current);
              pendingCloseHandleRef.current = null;
            }
            return;
          }

          pendingCloseRef.current = true;
          if (pendingCloseHandleRef.current !== null) {
            cancelAnimationFrame(pendingCloseHandleRef.current);
          }

          pendingCloseHandleRef.current = requestAnimationFrame(() => {
            pendingCloseHandleRef.current = null;
            if (!pendingCloseRef.current) return;
            pendingCloseRef.current = false;
            closePopover();
          });
        }}
      >
        <div className="flex w-full items-start gap-2">
          <div className="w-full">{children}</div>

          {totalCount > 0 && (
            <div className="flex-shrink-0 select-none pt-1">
              <PopoverTrigger
                asChild
                onClick={() => {
                  if (isDevEnv) {
                    console.debug('[BlockDiscussion] block button clicked', {
                      blockPath: blockPathKey,
                      discussionsCount,
                      suggestionsCount,
                    });
                  }
                  setForceListView(true);
                }}
              >
                <Button
                  variant="ghost"
                  className="mt-1 flex h-6 gap-1 pr-1.5 pl-1.5 py-0 text-muted-foreground/80 hover:text-muted-foreground/80 data-[active=true]:bg-muted"
                  data-active={open}
                  contentEditable={false}
                >
                  {suggestionsCount > 0 && discussionsCount === 0 && (
                    <PencilLineIcon className="size-4 shrink-0" />
                  )}

                  {suggestionsCount === 0 && discussionsCount > 0 && (
                    <MessageSquareTextIcon className="size-4 shrink-0 " />
                  )}

                  {suggestionsCount > 0 && discussionsCount > 0 && (
                    <MessagesSquareIcon className="size-4 shrink-0" />
                  )}

                  <span className="text-xs font-semibold">{totalCount}</span>
                </Button>
              </PopoverTrigger>
            </div>
          )}
        </div>
        {anchorElement && (
          <PopoverAnchor
            asChild
            className="w-full"
            virtualRef={{ current: anchorElement }}
          />
        )}

        <PopoverContent
          className="max-h-[min(50dvh,calc(-24px+var(--radix-popper-available-height)))] w-[380px] max-w-[calc(100vw-24px)] min-w-[130px] overflow-y-auto p-0 data-[state=closed]:opacity-0"
          align="center"
          side="bottom"
          onCloseAutoFocus={(event) => event.preventDefault()}
          onOpenAutoFocus={(event) => event.preventDefault()}
          data-comment-popover="true"
          data-comment-block-path={blockPath.join('.')}
        >
          {showAllThreads ? (
            sortedMergedData.length ? (
              sortedMergedData.map((item, index) =>
                isResolvedSuggestion(item) ? (
                  <BlockSuggestion
                    key={item.suggestionId}
                    suggestionId={item.suggestionId}
                    isLast={index === sortedMergedData.length - 1}
                  />
                ) : (
                  <BlockComment
                    key={item.id}
                    threadId={item.id}
                    isLast={index === sortedMergedData.length - 1}
                  />
                )
              )
            ) : (
              <div className="p-4 text-sm text-muted-foreground">
                No comments or suggestions attached to this block.
              </div>
            )
          ) : (
            <React.Fragment>
              {activeSuggestion && (
                <BlockSuggestion
                  suggestionId={activeSuggestion.suggestionId}
                  isLast
                />
              )}

              {activeDiscussion && (
                <BlockComment threadId={activeDiscussion.id} isLast />
              )}

              {!activeSuggestion && !activeDiscussion && (
                <div className="p-4 text-sm text-muted-foreground">
                  Select text and run "Add comment" to start a new thread.
                </div>
              )}
            </React.Fragment>
          )}
        </PopoverContent>

      </Popover>
    </div>
  );
};

const BlockComment = ({
  threadId,
  isLast,
}: {
  threadId: string;
  isLast: boolean;
}) => {
  return (
    <React.Fragment>
      <BlockThreadView threadId={threadId} />
      {!isLast && <div className="h-px w-full bg-muted" />}
    </React.Fragment>
  );
};

const BlockSuggestion = ({
  suggestionId,
  isLast,
}: {
  suggestionId: string;
  isLast: boolean;
}) => {
  return (
    <React.Fragment>
      <BlockThreadView threadId={suggestionId} isSuggestion />
      {!isLast && <div className="h-px w-full bg-muted" />}
    </React.Fragment>
  );
};

const useResolvedDiscussions = (
  commentNodes: NodeEntry<TCommentText>[],
  blockPath: Path
) => {
  const { api, getOption, setOption } = useEditorPlugin(commentPlugin);
  const threads = (getOption('threads') || {}) as Record<string, any>;
  const uniquePathMap = getOption('uniquePathMap');

  const pendingMap = React.useMemo(() => {
    let nextMap: Map<string, Path> | null = null;

    commentNodes.forEach(([node]) => {
      const ids = getCommentIdsFromNode(node);
      ids.forEach((id) => {
        const previousPath = uniquePathMap.get(id);

        if (PathApi.isPath(previousPath)) {
          const nodes = api.comment.node({ id, at: previousPath });

          if (!nodes) {
            if (!nextMap) nextMap = new Map(uniquePathMap);
            nextMap.set(id, blockPath);
          }

          return;
        }

        if (!nextMap) nextMap = new Map(uniquePathMap);
        nextMap.set(id, blockPath);
      });
    });

    return nextMap;
  }, [api.comment, blockPath, commentNodes, uniquePathMap]);

  React.useEffect(() => {
    if (pendingMap) {
      setOption('uniquePathMap', pendingMap);
    }
  }, [pendingMap, setOption]);

  const mapToUse = pendingMap ?? uniquePathMap;

  const commentIds = new Set(
    commentNodes
      .flatMap(([node]) => getCommentIdsFromNode(node))
      .filter((id): id is string => Boolean(id))
  );

  // Convert threads to discussion format for compatibility
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

const useResolvedSuggestions = (
  suggestionNodes: NodeEntry<TElement | TSuggestionText>[],
  blockPath: Path,
  suggestionMeta: Record<string, StoredSuggestion>
) => {
  const { api, getOption, setOption } = useEditorPlugin(suggestionPlugin);
  const uniquePathMap = getOption('uniquePathMap');

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
          if (!nextMap) nextMap = new Map(uniquePathMap);
          nextMap.set(id, blockPath);
        }
        return;
      }

      if (!nextMap) nextMap = new Map(uniquePathMap);
      nextMap.set(id, blockPath);
    });

    return nextMap;
  }, [api.suggestion, blockPath, suggestionNodes, uniquePathMap]);

  React.useEffect(() => {
    if (pendingMap) {
      setOption('uniquePathMap', pendingMap);
    }
  }, [pendingMap, setOption]);

  const mapToUse = pendingMap ?? uniquePathMap;

  return React.useMemo<ResolvedSuggestion[]>(() => {
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

    const resolved: ResolvedSuggestion[] = [];

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
  }, [api.suggestion, blockPath, mapToUse, suggestionMeta, suggestionNodes]);
};
