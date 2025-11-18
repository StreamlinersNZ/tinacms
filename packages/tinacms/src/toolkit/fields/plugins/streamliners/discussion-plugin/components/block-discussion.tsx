'use client';

import React from 'react';

import {
  type AnyPluginConfig,
  type NodeEntry,
  type Path,
  type TElement,
} from '@udecode/plate';
import { CommentsPlugin } from '@udecode/plate-comments/react';
import {
  PlateElementProps,
  RenderNodeWrapper,
  useEditorPlugin,
  usePluginOption,
} from '@udecode/plate/react';
import type { TSuggestionText } from '@udecode/plate-suggestion';
import { SuggestionPlugin as SuggestionPluginType } from '@udecode/plate-suggestion/react';
import {
  MessageSquareTextIcon,
  MessagesSquareIcon,
  PencilLineIcon,
} from 'lucide-react';

import { Button } from '../../../mdx-field-plugin/plate/components/plate-ui/button';
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from '../../../mdx-field-plugin/plate/components/plate-ui/popover';
import { suggestionPlugin } from '../../suggestion-plugin/suggestion-plugin';
import { commentPlugin } from '../plugins/comment-plugin';
import { getCommentIdsFromNode } from '../utils/comment-ids';
import { type StoredSuggestion } from '../utils/annotations-store';
import { BlockThreadView } from './block-thread-view';
import type { TCommentText } from './comment-node';
import type { TDiscussion } from '../types';
import {
  useAnnotationAnchor,
  useResolvedDiscussions,
  useResolvedSuggestions,
} from '../hooks/discussion-hooks';

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

type PopoverStateArgs = {
  blockPath: Path;
  annotationActive: boolean;
  selected: boolean;
  noneActive: boolean;
  activeCommentId: string | null;
  activeSuggestionId: string | null;
  setCommentOption: (key: string, value: unknown) => void;
  setSuggestionOption: (key: string, value: unknown) => void;
};

const useBlockPopoverState = ({
  blockPath,
  annotationActive,
  selected,
  noneActive,
  activeCommentId,
  activeSuggestionId,
  setCommentOption,
  setSuggestionOption,
}: PopoverStateArgs) => {
  const blockPathKey = React.useMemo(() => blockPath.join('.'), [blockPath]);
  const [internalOpen, setInternalOpen] = React.useState(false);
  const [forceListView, setForceListView] = React.useState(false);
  const pendingCloseRef = React.useRef(false);
  const pendingCloseHandleRef = React.useRef<number | null>(null);

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
    [blockPathKey, setCommentOption, setSuggestionOption]
  );

  const open = annotationActive ? false : internalOpen || selected;

  const handleOpenChange = React.useCallback(
    (next: boolean) => {
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
    },
    [annotationActive, closePopover, internalOpen]
  );

  React.useEffect(() => {
    if (!isDevEnv) return;
    console.debug('[BlockDiscussion] popover open change', {
      blockPath: blockPathKey,
      open,
      internalOpen,
      selected,
    });
  }, [blockPathKey, open, internalOpen, selected]);

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

  return {
    open,
    forceListView,
    setForceListView,
    showAllThreads: forceListView || noneActive,
    handleOpenChange,
    closePopover,
  };
};

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
  const blockPathKey = React.useMemo(() => blockPath.join('.'), [blockPath]);
  const {
    editor: suggestionEditor,
    setOption: setSuggestionOption,
  } = useEditorPlugin(suggestionPlugin);
  const suggestionMetadata = (suggestionEditor.getOption(
    suggestionPlugin,
    'metadata'
  ) || {}) as Record<string, any>;

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

  const annotationActive =
    Boolean(activeCommentId) || Boolean(activeSuggestionId);
  const {
    open,
    forceListView,
    setForceListView,
    showAllThreads,
    handleOpenChange,
    closePopover,
  } = useBlockPopoverState({
    blockPath,
    annotationActive,
    selected,
    noneActive,
    activeCommentId: activeCommentId as string | null,
    activeSuggestionId: activeSuggestionId as string | null,
    setCommentOption,
    setSuggestionOption,
  });


  const anchorElement = useAnnotationAnchor(
    blockPath,
    commentNodes,
    suggestionNodes,
    activeCommentId as string | null,
    activeSuggestionId as string | null
  );

  if (totalCount === 0) {
    return <div className="w-full">{children}</div>;
  }

  return (
    <div className="w-full">
      <Popover open={open} onOpenChange={handleOpenChange}>
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
          <BlockThreadsPanel
            showAllThreads={showAllThreads}
            sortedData={sortedMergedData}
            activeDiscussionId={activeDiscussion?.id ?? null}
            activeSuggestionId={activeSuggestion?.suggestionId ?? null}
          />
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

const BlockThreadsPanel = ({
  showAllThreads,
  sortedData,
  activeDiscussionId,
  activeSuggestionId,
}: {
  showAllThreads: boolean;
  sortedData: Array<TDiscussion | ResolvedSuggestion>;
  activeDiscussionId: string | null;
  activeSuggestionId: string | null;
}) => {
  if (showAllThreads) {
    if (!sortedData.length) {
      return (
        <div className="p-4 text-sm text-muted-foreground">
          No comments or suggestions attached to this block.
        </div>
      );
    }

    return (
      <React.Fragment>
        {sortedData.map((item, index) =>
          isResolvedSuggestion(item) ? (
            <BlockSuggestion
              key={item.suggestionId}
              suggestionId={item.suggestionId}
              isLast={index === sortedData.length - 1}
            />
          ) : (
            <BlockComment
              key={item.id}
              threadId={item.id}
              isLast={index === sortedData.length - 1}
            />
          )
        )}
      </React.Fragment>
    );
  }

  return (
    <React.Fragment>
      {activeSuggestionId && (
        <BlockSuggestion suggestionId={activeSuggestionId} isLast={!activeDiscussionId} />
      )}
      {activeDiscussionId && <BlockComment threadId={activeDiscussionId} isLast />}
      {!activeSuggestionId && !activeDiscussionId && (
        <div className="p-4 text-sm text-muted-foreground">
          Select text and run "Add comment" to start a new thread.
        </div>
      )}
    </React.Fragment>
  );
};
