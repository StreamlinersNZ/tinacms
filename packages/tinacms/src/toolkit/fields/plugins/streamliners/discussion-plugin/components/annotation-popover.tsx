'use client';

import React from 'react';

import { PortalBody, cn } from '@udecode/cn';
import { BaseCommentsPlugin, getCommentKey } from '@udecode/plate-comments';
import { useEditorPlugin, usePluginOption } from '@udecode/plate/react';

import {
  commentPlugin,
  type CommentMessage,
  type CommentThread,
} from '../plugins/comment-plugin';
import {
  appendMessageToThread,
  ensureCommentMark,
  clearCommentThread,
  getSuggestionDiff,
  createAnnotationId,
  acceptActiveSuggestion,
  rejectActiveSuggestion,
} from '../utils/annotation-util';
import { suggestionPlugin } from '../../suggestion-plugin/suggestion-plugin';
import {
  SuggestionDiff,
  CommentInput,
  ThreadSubject,
  ThreadMessages,
} from '.';
import {
  useAnnotationThreads,
  useAnnotationUser,
} from '../hooks/use-annotation-state';
import { Loader2 } from 'lucide-react';

const POP_WIDTH = 380;

export function AnnotationPopover() {
  const {
    api: commentApi,
    editor,
    setOption: setCommentOption,
  } = useEditorPlugin(commentPlugin);
  const { setOption: setSuggestionOption } = useEditorPlugin(suggestionPlugin);
  const currentUser = useAnnotationUser();
  const {
    getThreads,
    commitThread: commitThreadUpdate,
    deleteThread,
    removeEmptyThreads,
  } = useAnnotationThreads();

  const commentActiveId = usePluginOption(commentPlugin, 'activeId') as
    | string
    | null;
  const suggestionActiveId = usePluginOption(suggestionPlugin, 'activeId') as
    | string
    | null;
  const overlappingIds = usePluginOption(commentPlugin, 'overlappingIds') as
    | string[]
    | null;

  // Get data directly from plugin options (single source of truth)
  const comments = getThreads();

  const [position, setPosition] = React.useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  React.useEffect(() => {
    console.log('[AnnotationPopover] state change', {
      commentActiveId,
      suggestionActiveId,
      commentThreadCount: Object.keys(comments).length,
    });
  }, [commentActiveId, suggestionActiveId, comments]);

  const anchorIds = React.useMemo(() => {
    const ids: string[] = [];
    if (commentActiveId) ids.push(commentActiveId);
    if (suggestionActiveId && suggestionActiveId !== commentActiveId) {
      ids.push(suggestionActiveId);
    }
    return ids;
  }, [commentActiveId, suggestionActiveId]);

  React.useEffect(() => {
    if (!anchorIds.length) {
      console.log('[AnnotationPopover] no anchor ids, hiding popover');
      setPosition(null);
      return;
    }

    const selectors = anchorIds.flatMap((id) => [
      `[data-comment-leaf="true"][data-comment-id="${id}"]`,
      `[data-suggestion-leaf="true"][data-suggestion-id="${id}"]`,
    ]);

    let anchorElement: HTMLElement | null = null;
    selectors.some((selector) => {
      const element = document.querySelector<HTMLElement>(selector);
      if (element) {
        anchorElement = element;
        return true;
      }
      return false;
    });

    if (!anchorElement) {
      console.log('[AnnotationPopover] anchor element not found', {
        selectors,
      });
      setPosition(null);
      return;
    }

    const update = () => {
      const rect = anchorElement!.getBoundingClientRect();
      console.log('[AnnotationPopover] updating position', rect);
      setPosition({
        top: window.scrollY + rect.bottom + 8,
        left: window.scrollX + rect.left,
        width: rect.width,
      });
    };

    update();

    const observer = new ResizeObserver(update);
    observer.observe(anchorElement);
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);

    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [anchorIds]);

  const threadId = commentActiveId ?? suggestionActiveId ?? null;
  const thread: CommentThread | null = threadId
    ? comments[threadId] ?? null
    : null;

  const suggestionTargetId = suggestionActiveId ?? threadId ?? null;
  const suggestionDiff = React.useMemo(() => {
    if (!suggestionTargetId) return null;
    return getSuggestionDiff(editor, suggestionTargetId);
  }, [editor, suggestionTargetId]);

  const draftSuggestionThread = React.useMemo(() => {
    if (!suggestionActiveId) return null;
    if (comments[suggestionActiveId]) return null;

    const subject =
      suggestionDiff?.deletedText ?? suggestionDiff?.insertedText ?? '';

    const placeholder: CommentThread = {
      id: suggestionActiveId,
      createdAt: new Date().toISOString(),
      messages: [],
      discussionSubject: subject,
      documentContent: subject,
    };

    return placeholder;
  }, [comments, suggestionActiveId, suggestionDiff]);

  // Get all overlapping threads for display
  const threadsToDisplay = React.useMemo(() => {
    if (overlappingIds && overlappingIds.length > 1) {
      // Filter to only threads that exist
      return overlappingIds
        .map((id) => comments[id])
        .filter((t): t is CommentThread => t != null);
    }

    if (thread) return [thread];
    if (draftSuggestionThread) return [draftSuggestionThread];

    return [];
  }, [comments, draftSuggestionThread, overlappingIds, thread]);

  const [replyValue, setReplyValue] = React.useState('');
  const [editingMessageId, setEditingMessageId] = React.useState<string | null>(
    null
  );
  const [editingValue, setEditingValue] = React.useState('');

  React.useEffect(() => {
    setReplyValue('');
    setEditingMessageId(null);
    setEditingValue('');
  }, [commentActiveId, suggestionActiveId]);

  const shouldHidePopover = (!threadId && !suggestionActiveId) || !position;
  const isLoadingUser = !currentUser;

  const closePopover = React.useCallback(() => {
    if (!suggestionActiveId) {
      const idsToCheck =
        overlappingIds && overlappingIds.length > 0
          ? overlappingIds
          : commentActiveId
          ? [commentActiveId]
          : null;
      removeEmptyThreads(idsToCheck);
    }

    setCommentOption('activeId', null);
    setCommentOption('hoverId', null);
    setSuggestionOption('activeId', null);
  }, [
    commentActiveId,
    overlappingIds,
    removeEmptyThreads,
    setCommentOption,
    setSuggestionOption,
    suggestionActiveId,
  ]);

  const handleReplySubmit = () => {
    if (!threadId) return;
    const value = replyValue.trim();
    if (!value) return;

    const baseThread: CommentThread =
      thread ??
      ({
        id: threadId,
        createdAt: new Date().toISOString(),
        messages: [],
        discussionSubject:
          suggestionDiff?.deletedText ??
          suggestionDiff?.insertedText ??
          '',
        documentContent:
          suggestionDiff?.deletedText ??
          suggestionDiff?.insertedText ??
          '',
      } as CommentThread);

    const updatedThread = appendMessageToThread({
      thread: baseThread,
      body: value,
      author: currentUser,
    });

    if (!thread) {
      ensureCommentMark(editor, threadId);
    }

    commitThreadUpdate(updatedThread);
    console.log('[AnnotationPopover] handleReplySubmit appended reply', {
      threadId,
      replyLength: updatedThread.messages?.length ?? 0,
    });
    setReplyValue('');
  };

  const handleDeleteMessage = (messageId: string) => {
    if (!thread) return;
    const updatedMessages =
      thread.messages?.filter((message) => message.id !== messageId) ?? [];
    const updatedThread: CommentThread = {
      ...thread,
      messages: updatedMessages,
    };

    commitThreadUpdate(updatedThread);
    if (editingMessageId === messageId) {
      setEditingMessageId(null);
      setEditingValue('');
    }
  };

  const handleDeleteThread = () => {
    if (!threadId) return;

    deleteThread(threadId);
    if (suggestionDiff && suggestionTargetId === threadId) {
      clearCommentThread(editor, threadId);
      setSuggestionOption('activeId', null);
    }
    closePopover();
  };

  const handleEditMessage = (messageId: string) => {
    if (!thread) return;
    const message = thread.messages?.find((item) => item.id === messageId);
    if (!message) return;
    setEditingMessageId(messageId);
    setEditingValue(message.body ?? '');
  };

  const handleSubmitEdit = () => {
    if (!thread || !editingMessageId) return;
    const value = editingValue.trim();
    if (!value) return;

    const timestamp = new Date().toISOString();
    const updatedMessages = (thread.messages ?? []).map((message) =>
      message.id === editingMessageId
        ? {
            ...message,
            body: value,
            updatedAt: timestamp,
          }
        : message
    );

    const updatedThread: CommentThread = {
      ...thread,
      messages: updatedMessages,
      updatedAt: timestamp,
    };

    commitThreadUpdate(updatedThread);
    setEditingMessageId(null);
    setEditingValue('');
  };

  const handleAcceptSuggestion = () => {
    if (!suggestionDiff || !suggestionTargetId) return;
    acceptActiveSuggestion({
      editor,
      suggestionId: suggestionTargetId,
      diff: suggestionDiff,
      userId: currentUser?.id,
    });

    deleteThread(suggestionTargetId);
    clearCommentThread(editor, suggestionTargetId);
    setSuggestionOption('activeId', null);
    if (commentActiveId === suggestionTargetId) {
      setCommentOption('activeId', null);
    }
  };

  const handleRejectSuggestion = () => {
    if (!suggestionDiff || !suggestionTargetId) return;
    rejectActiveSuggestion({
      editor,
      suggestionId: suggestionTargetId,
      diff: suggestionDiff,
      userId: currentUser?.id,
    });

    deleteThread(suggestionTargetId);
    clearCommentThread(editor, suggestionTargetId);
    setSuggestionOption('activeId', null);
    if (commentActiveId === suggestionTargetId) {
      setCommentOption('activeId', null);
    }
  };

  const handleClose = () => {
    closePopover();
  };

  const lastActiveCommentRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (suggestionActiveId) {
      lastActiveCommentRef.current = commentActiveId ?? null;
      return;
    }

    const previousId = lastActiveCommentRef.current;
    if (!commentActiveId && previousId) {
      const idsToCheck =
        overlappingIds && overlappingIds.length > 0
          ? overlappingIds
          : [previousId];
      removeEmptyThreads(idsToCheck);
    }

    lastActiveCommentRef.current = commentActiveId ?? null;
  }, [commentActiveId, overlappingIds, removeEmptyThreads, suggestionActiveId]);

  if (shouldHidePopover) {
    return null;
  }

  return (
    <PortalBody>
      <div
        className={cn(
          'absolute z-[999998] rounded-lg border bg-popover p-4 shadow-xl print:hidden',
          'w-full max-w-[380px]'
        )}
        style={{
          top: position.top,
          left: position.left,
          minWidth: Math.max(position.width, POP_WIDTH / 2),
        }}
        data-annotation-popover="true"
        onMouseDown={(event) => event.stopPropagation()}
      >
        {suggestionDiff && suggestionTargetId ? (
          <SuggestionDiff
            deletedText={suggestionDiff.deletedText}
            insertedText={suggestionDiff.insertedText}
            onAccept={handleAcceptSuggestion}
            onReject={handleRejectSuggestion}
            isLoading={isLoadingUser}
          />
        ) : null}

        {threadsToDisplay.length > 0 ? (
          <div className="flex flex-col gap-4">
            {threadsToDisplay.length > 1 && (
              <div className="text-sm font-medium text-muted-foreground">
                {threadsToDisplay.length} overlapping comments
              </div>
            )}

            {threadsToDisplay.map((displayThread, threadIndex) => {
              const isActiveThread = displayThread.id === threadId;
              const isLastThread = threadIndex === threadsToDisplay.length - 1;

              return (
                <div key={displayThread.id} className="flex flex-col gap-4">
                  <ThreadSubject subject={displayThread.discussionSubject} />

                  <ThreadMessages
                    messages={displayThread.messages}
                    currentUserId={currentUser?.id}
                    editingMessageId={
                      isActiveThread ? editingMessageId : undefined
                    }
                    editingValue={isActiveThread ? editingValue : undefined}
                    onEdit={isActiveThread ? handleEditMessage : undefined}
                    onDelete={isActiveThread ? handleDeleteMessage : undefined}
                    onEditingValueChange={
                      isActiveThread ? setEditingValue : undefined
                    }
                    onSubmitEdit={isActiveThread ? handleSubmitEdit : undefined}
                    onCancelEdit={
                      isActiveThread
                        ? () => {
                            setEditingMessageId(null);
                            setEditingValue('');
                          }
                        : undefined
                    }
                  />

                  {isActiveThread && (
                    <div className="flex flex-col gap-2">
                      <CommentInput
                        value={replyValue}
                        onChange={setReplyValue}
                        onSubmit={handleReplySubmit}
                        placeholder={
                          displayThread.messages?.length
                            ? 'Reply…'
                            : 'Add a comment…'
                        }
                        submitLabel={
                          displayThread.messages?.length ? 'Reply' : 'Comment'
                        }
                        minHeight="60px"
                        autoFocus={!displayThread.messages?.length}
                        isLoading={isLoadingUser}
                      />
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          onClick={handleClose}
                          className="rounded-md border border-input bg-transparent px-3 py-1.5 text-sm text-muted-foreground shadow-sm transition-colors hover:bg-accent"
                        >
                          Close
                        </button>
                        {displayThread.messages?.[0]?.authorId === currentUser?.id || displayThread.messages?.[0]?.authorId === 'anonymous' || displayThread.messages?.[0]?.authorId === undefined && (
                          <button
                            type="button"
                            onClick={handleDeleteThread}
                            className="rounded-md border border-destructive bg-transparent px-3 py-1.5 text-sm text-destructive shadow-sm transition-colors hover:bg-destructive hover:text-destructive-foreground"
                          >
                            Delete Thread
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {!isLastThread && (
                    <div className="border-t border-border" />
                  )}
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </PortalBody>
  );
}
