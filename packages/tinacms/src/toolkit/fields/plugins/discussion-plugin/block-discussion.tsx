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
import { getDraftCommentKey } from '@udecode/plate-comments';
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

import { Button } from '../mdx-field-plugin/plate/components/plate-ui/button';
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from '../mdx-field-plugin/plate/components/plate-ui/popover';
import { suggestionPlugin } from '../suggestion-plugin/suggestion-plugin';
import { CommentCard } from './comment-card';
import { CommentCreateForm } from './comment-create-form';
import { commentPlugin } from './comment-plugin';
import { useAnnotationsStore, type StoredSuggestion } from './annotations-store';
import { discussionPlugin } from './discussion-plugin';
import { SuggestionCard } from './suggestion-card';
import type { TCommentText } from './comment-node';
import type { TDiscussion } from './types';

type ResolvedSuggestion = {
  suggestionId: string;
  createdAt: Date;
  userId?: string;
  status?: StoredSuggestion['status'];
};

const isResolvedSuggestion = (
  item: TDiscussion | ResolvedSuggestion
): item is ResolvedSuggestion => 'suggestionId' in item;

export const BlockDiscussion: RenderNodeWrapper<AnyPluginConfig> = (props) => {
  const { editor, element } = props;
  const commentsApi = editor.getApi(CommentsPlugin).comment;
  const blockPath = editor.api.findPath(element);

  if (!blockPath) return;

  const draftCommentNode = commentsApi.node({ at: blockPath, isDraft: true });
  const commentNodes = [
    ...commentsApi.nodes({ at: blockPath }),
  ] as NodeEntry<TCommentText>[];
  const suggestionNodes = [
    ...editor.getApi(SuggestionPluginType).suggestion.nodes({ at: blockPath }),
  ];

  if (
    commentNodes.length === 0 &&
    suggestionNodes.length === 0 &&
    !draftCommentNode
  ) {
    return null;
  }

  return (props) => (
    <BlockDiscussionContent
      blockPath={blockPath}
      commentNodes={commentNodes}
      draftCommentNode={draftCommentNode as NodeEntry<TCommentText> | undefined}
      suggestionNodes={suggestionNodes}
      {...props}
    />
  );
};

const BlockDiscussionContent = ({
  blockPath,
  children,
  commentNodes,
  draftCommentNode,
  suggestionNodes,
}: PlateElementProps & {
  blockPath: Path;
  commentNodes: NodeEntry<TCommentText>[];
  draftCommentNode: NodeEntry<TCommentText> | undefined;
  suggestionNodes: NodeEntry<TElement | TSuggestionText>[];
}) => {
  const editor = useEditorRef();
  const { annotations } = useAnnotationsStore();
  const resolvedSuggestions = useResolvedSuggestions(
    suggestionNodes,
    blockPath,
    annotations.suggestions
  );
  const resolvedDiscussions = useResolvedDiscussions(commentNodes, blockPath);

  const suggestionsCount = resolvedSuggestions.length;
  const discussionsCount = resolvedDiscussions.length;
  const totalCount = suggestionsCount + discussionsCount;

  const { setOption: setCommentOption } = useEditorPlugin(commentPlugin);
  const { setOption: setSuggestionOption } = useEditorPlugin(suggestionPlugin);
  const commentingBlock = usePluginOption(commentPlugin, 'commentingBlock');
  const blockPathKey = React.useMemo(() => blockPath.join('.'), [blockPath]);
  const commentingBlockKey = commentingBlock
    ? commentingBlock.join('.')
    : null;
  const activeCommentId = usePluginOption(commentPlugin, 'activeId');
  const activeSuggestionId = usePluginOption(suggestionPlugin, 'activeId');
  const isCommenting = activeCommentId === getDraftCommentKey();

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

  const commentingCurrent =
    !!commentingBlock && PathApi.equals(blockPath, commentingBlock);

  const selected =
    resolvedDiscussions.some((discussion) => discussion.id === activeCommentId) ||
    resolvedSuggestions.some(
      (suggestion) => suggestion.suggestionId === activeSuggestionId
    );

  const [internalOpen, setInternalOpen] = React.useState(selected);
  const open =
    internalOpen ||
    selected ||
    (isCommenting && !!draftCommentNode && commentingCurrent);

  const closePopover = React.useCallback(() => {
    setInternalOpen(false);
    setCommentOption('activeId', null);
    setCommentOption('commentingBlock', null);
    setCommentOption('draft', null);
    setSuggestionOption('activeId', null);

    if (draftCommentNode) {
      editor.tf.unsetNodes(getDraftCommentKey(), {
        at: [],
        mode: 'lowest',
        match: (node) => Boolean((node as any)[getDraftCommentKey()]),
      });
    }

    if (process.env.NODE_ENV !== 'production') {
      console.debug('[BlockDiscussion] popover closed', {
        blockPath: blockPathKey,
      });
    }
  }, [
    blockPathKey,
    draftCommentNode,
    editor,
    setCommentOption,
    setSuggestionOption,
  ]);

  React.useEffect(() => {
    if (isCommenting) {
      setInternalOpen(true);
    }
  }, [isCommenting]);

  React.useEffect(() => {
    if (!isCommenting || !draftCommentNode) return;
    if (commentingBlockKey === blockPathKey) return;
    setCommentOption('commentingBlock', blockPath);
  }, [
    blockPath,
    blockPathKey,
    commentingBlockKey,
    draftCommentNode,
    isCommenting,
    setCommentOption,
  ]);

  if (process.env.NODE_ENV !== 'production') {
    console.debug('[BlockDiscussion] state snapshot', {
      blockPath: blockPathKey,
      totalCount,
      isCommenting,
      commentingCurrent,
      hasDraft: Boolean(draftCommentNode),
      activeCommentId,
      activeSuggestionId,
    });
  }

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
      if (activeCommentId === getDraftCommentKey()) {
        activeEntry = draftCommentNode;
      } else {
        activeEntry = commentNodes.find(([node]) => {
          const id = editor.getApi(CommentsPlugin).comment.nodeId(node);
          return id === activeCommentId;
        });
      }
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
    draftCommentNode,
    editor,
    suggestionNodes,
  ]);

  if (totalCount === 0 && !draftCommentNode && !isCommenting) {
    return <div className="w-full">{children}</div>;
  }

  return (
    <div className="flex w-full justify-between">
      <Popover
        open={open}
        onOpenChange={(next) => {
          if (next) {
            setInternalOpen(true);
          } else {
            closePopover();
          }
        }}
      >
        <div className="w-full">{children}</div>
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
          {isCommenting ? (
            <div className="p-4">
              <CommentCreateForm autoFocus placeholder="Comment…" />
            </div>
          ) : (
            <React.Fragment>
              {noneActive ? (
                sortedMergedData.map((item, index) =>
                  isResolvedSuggestion(item) ? (
                    <SuggestionCard
                      key={item.suggestionId}
                      suggestionId={item.suggestionId}
                    />
                  ) : (
                    <BlockComment
                      key={item.id}
                      discussion={item}
                      isLast={index === sortedMergedData.length - 1}
                    />
                  )
                )
              ) : (
                <React.Fragment>
                  {activeSuggestion && (
                    <SuggestionCard suggestionId={activeSuggestion.suggestionId} />
                  )}

                  {activeDiscussion && (
                    <BlockComment discussion={activeDiscussion} isLast />
                  )}
                </React.Fragment>
              )}

              {!sortedMergedData.length && !draftCommentNode && (
                <div className="p-4 text-sm text-muted-foreground">
                  No comments or suggestions attached to this block.
                </div>
              )}
            </React.Fragment>
          )}
        </PopoverContent>

        {totalCount > 0 && (
          <div className="relative left-0 size-0 select-none">
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                className="mt-1 ml-1 flex h-6 gap-1 px-1.5 py-0 text-muted-foreground/80 hover:text-muted-foreground/80 data-[active=true]:bg-muted"
                data-active={open}
                contentEditable={false}
              >
                {suggestionsCount > 0 && discussionsCount === 0 && (
                  <PencilLineIcon className="size-4 shrink-0" />
                )}

                {suggestionsCount === 0 && discussionsCount > 0 && (
                  <MessageSquareTextIcon className="size-4 shrink-0" />
                )}

                {suggestionsCount > 0 && discussionsCount > 0 && (
                  <MessagesSquareIcon className="size-4 shrink-0" />
                )}

                <span className="text-xs font-semibold">{totalCount}</span>
              </Button>
            </PopoverTrigger>
          </div>
        )}
      </Popover>
    </div>
  );
};

const BlockComment = ({
  discussion,
  isLast,
}: {
  discussion: TDiscussion;
  isLast: boolean;
}) => {
  return (
    <React.Fragment>
      <div className="p-4">
        {discussion.discussionSubject && (
          <div className="mb-2 text-xs text-muted-foreground">
            {discussion.discussionSubject}
          </div>
        )}
        {discussion.comments.map((comment) => (
          <CommentCard key={comment.id} comment={comment} />
        ))}
        <CommentCreateForm discussionId={discussion.id} placeholder="Reply…" />
      </div>
      {!isLast && <div className="h-px w-full bg-muted" />}
    </React.Fragment>
  );
};

const useResolvedDiscussions = (
  commentNodes: NodeEntry<TCommentText>[],
  blockPath: Path
) => {
  const { api, getOption, setOption } = useEditorPlugin(commentPlugin);
  const discussions =
    (usePluginOption(discussionPlugin, 'discussions') as TDiscussion[]) ?? [];
  const uniquePathMap = getOption('uniquePathMap');

  const pendingMap = React.useMemo(() => {
    let nextMap: Map<string, Path> | null = null;

    commentNodes.forEach(([node]) => {
      const id = api.comment.nodeId(node);
      if (!id) return;

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
      .map(([node]) => api.comment.nodeId(node))
      .filter((id): id is string => Boolean(id))
  );

  return discussions
    .map((discussion) => ({
      ...discussion,
      createdAt: new Date(discussion.createdAt),
    }))
    .filter((discussion) => {
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
