'use client';

import React from 'react';

import { PortalBody, cn } from '@udecode/cn';
import { BaseCommentsPlugin, getCommentKey } from '@udecode/plate-comments';
import { useEditorPlugin, usePluginOption } from '@udecode/plate/react';
import { useCMS } from '@toolkit/react-core';
import { Pencil, Trash2 } from 'lucide-react';

import {
  commentPlugin,
  type CommentMessage,
  type CommentThread,
} from './comment-plugin';
import {
  DRAFT_COMMENT_KEY,
  appendMessageToThread,
  collectHighlightedSubject,
  ensureCommentMark,
  clearCommentThread,
  getSuggestionDiff,
  createAnnotationId,
  acceptActiveSuggestion,
  rejectActiveSuggestion,
  formatTimestamp,
} from './annotation-util';
import { suggestionPlugin } from '../suggestion-plugin/suggestion-plugin';
import { useAnnotationsStore } from './annotations-store';

type CurrentUser = { id?: string; name?: string } | null;

const POP_WIDTH = 380;

export function AnnotationPopover() {
  const cms = useCMS();
  const {
    api: commentApi,
    editor,
    setOption: setCommentOption,
  } = useEditorPlugin(commentPlugin);
  const { setOption: setSuggestionOption } = useEditorPlugin(suggestionPlugin);

  const commentActiveId = usePluginOption(commentPlugin, 'activeId') as
    | string
    | null;
  const suggestionActiveId = usePluginOption(suggestionPlugin, 'activeId') as
    | string
    | null;
  const { annotations, setComments } = useAnnotationsStore();
  const comments = annotations.comments;
  const draftState = usePluginOption(commentPlugin, 'draft');

  const [currentUser, setCurrentUser] = React.useState<CurrentUser>(null);

  React.useEffect(() => {
    void cms.api.tina.authProvider.getUser().then((user) => {
      if (!user) {
        setCurrentUser({ id: 'anonymous', name: 'Anonymous' });
        return;
      }
      const id = user.id ?? user.email ?? 'anonymous';
      const name = user.name ?? user.email ?? 'Anonymous';
      setCurrentUser({ id, name });
    });
  }, [cms.api.tina.authProvider]);

  const [position, setPosition] = React.useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  const isDraft = commentActiveId === DRAFT_COMMENT_KEY;

  React.useEffect(() => {
    console.log('[AnnotationPopover] state change', {
      commentActiveId,
      suggestionActiveId,
      commentThreadCount: Object.keys(comments).length,
      isDraft,
    });
  }, [commentActiveId, suggestionActiveId, comments, isDraft]);

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

  const threadId = isDraft
    ? null
    : commentActiveId ?? suggestionActiveId ?? null;
  const thread: CommentThread | null = threadId
    ? comments[threadId] ?? null
    : null;

  const suggestionTargetId = suggestionActiveId ?? threadId ?? null;
  const suggestionDiff = React.useMemo(() => {
    if (!suggestionTargetId) return null;
    return getSuggestionDiff(editor, suggestionTargetId);
  }, [editor, suggestionTargetId]);

  const [draftValue, setDraftValue] = React.useState('');
  const [replyValue, setReplyValue] = React.useState('');
  const [editingMessageId, setEditingMessageId] = React.useState<string | null>(
    null
  );
  const [editingValue, setEditingValue] = React.useState('');

  React.useEffect(() => {
    if (isDraft) {
      setDraftValue(draftState?.text ?? '');
    } else {
      setDraftValue('');
    }
    setReplyValue('');
    setEditingMessageId(null);
    setEditingValue('');
  }, [isDraft, draftState?.text, commentActiveId, suggestionActiveId]);

  const shouldHidePopover =
    (!isDraft && !threadId && !suggestionActiveId) || !position;

  const closePopover = () => {
    setCommentOption('activeId', null);
    setCommentOption('hoverId', null);
    setSuggestionOption('activeId', null);
  };

  const handleCancelDraft = () => {
    const draftEntries =
      commentApi.comment.nodes?.({ isDraft: true }) ?? [];

    if (draftEntries.length) {
      editor.tf.withoutNormalizing(() => {
        draftEntries.forEach(([, path]) => {
          editor.tf.unsetNodes(DRAFT_COMMENT_KEY, { at: path });
          editor.tf.unsetNodes(BaseCommentsPlugin.key, { at: path });
        });
      });
    }

    setCommentOption('draft', null);
    closePopover();
  };

  const commitThreadUpdate = React.useCallback(
    (nextThread: CommentThread) => {
      console.log('[AnnotationPopover] commitThreadUpdate', {
        threadId: nextThread.id,
        messageCount: nextThread.messages?.length ?? 0,
      });
      setComments((previous) => ({
        ...previous,
        [nextThread.id]: nextThread,
      }));
    },
    [setComments]
  );

  const handleSubmitDraft = () => {
    const value = draftValue.trim();
    if (!value) return;

    const draftEntries =
      commentApi.comment.nodes?.({ isDraft: true }) ?? [];
    if (!draftEntries.length) return;

    const threadId = createAnnotationId('comment-thread');
    const timestamp = new Date().toISOString();
    const discussionSubject = collectHighlightedSubject(draftEntries);

    const initialMessage: CommentMessage = {
      id: createAnnotationId('comment'),
      body: value,
      createdAt: timestamp,
      authorId: currentUser?.id,
      authorName: currentUser?.name,
    };

    const nextThread: CommentThread = {
      id: threadId,
      createdAt: timestamp,
      messages: [initialMessage],
      discussionSubject,
      documentContent: discussionSubject,
    };

    editor.tf.withoutNormalizing(() => {
      draftEntries.forEach(([, path]) => {
        editor.tf.setNodes(
          {
            comment: true,
            [getCommentKey(threadId)]: true,
            [BaseCommentsPlugin.key]: true,
          },
          { at: path }
        );
        editor.tf.unsetNodes(DRAFT_COMMENT_KEY, { at: path });
      });
    });

    setComments((previous) => ({
      ...previous,
      [threadId]: nextThread,
    }));
    console.log('[AnnotationPopover] handleSubmitDraft created thread', {
      threadId,
      discussionSubject,
    });
    setCommentOption('draft', null);
    setCommentOption('activeId', threadId);
  };

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

    editor.getTransforms(commentPlugin).comment.unsetMark?.({
      id: threadId,
    });
    const { [threadId]: _removed, ...rest } = comments;
    setComments(rest);
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

    if (comments[suggestionTargetId]) {
      const { [suggestionTargetId]: _removed, ...rest } = comments;
      setComments(rest);
    }
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

    if (comments[suggestionTargetId]) {
      const { [suggestionTargetId]: _removed, ...rest } = comments;
      setComments(rest);
    }
    clearCommentThread(editor, suggestionTargetId);
    setSuggestionOption('activeId', null);
    if (commentActiveId === suggestionTargetId) {
      setCommentOption('activeId', null);
    }
  };

  const handleClose = () => {
    closePopover();
  };

  const disableReply = !replyValue.trim();

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
          <div className="mb-4 space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Suggestion
            </div>
            <div className="space-y-2 text-sm text-muted-foreground">
              {suggestionDiff.deletedText && (
                <div>
                  <span className="font-semibold text-red-600">Delete:</span>{' '}
                  {suggestionDiff.deletedText}
                </div>
              )}
              {suggestionDiff.insertedText && (
                <div>
                  <span className="font-semibold text-emerald-600">Add:</span>{' '}
                  {suggestionDiff.insertedText}
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleAcceptSuggestion}
                className="flex flex-1 items-center justify-center rounded-md border border-emerald-500 px-2 py-1 text-xs font-semibold text-emerald-600 transition hover:bg-emerald-50"
              >
                Accept
              </button>
              <button
                type="button"
                onClick={handleRejectSuggestion}
                className="flex flex-1 items-center justify-center rounded-md border border-destructive px-2 py-1 text-xs font-semibold text-destructive transition hover:bg-destructive/10"
              >
                Reject
              </button>
            </div>
          </div>
        ) : null}

        {isDraft ? (
          <div className="flex flex-col gap-3">
            <textarea
              className="min-h-[80px] w-full resize-y rounded-md border bg-background p-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              placeholder="Add a comment…"
              value={draftValue}
              onChange={(event) => {
                setDraftValue(event.target.value);
                setCommentOption('draft', { text: event.target.value });
              }}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={handleCancelDraft}
                className="rounded-md border border-input bg-transparent px-3 py-1.5 text-sm text-muted-foreground shadow-sm transition-colors hover:bg-accent"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitDraft}
                disabled={!draftValue.trim()}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white shadow-sm transition-colors hover:bg-blue-600/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Comment
              </button>
            </div>
          </div>
        ) : threadId ? (
          <div className="flex flex-col gap-4">
            {thread?.discussionSubject && (
              <div className="flex flex-col gap-1.5">
                <div className="text-sm font-medium text-foreground">Subject</div>
                <blockquote className="rounded-md border-l-4 border-blue-500 bg-blue-500/10 p-3 text-sm text-foreground">
                  {thread.discussionSubject}
                </blockquote>
              </div>
            )}

            {thread?.messages?.length ? (
              <div className="flex flex-col gap-1.5">
                <div className="text-sm font-medium">Discussion</div>
                <div className="max-h-[280px] overflow-y-auto">
                  <div className="flex flex-col">
                    {(thread.messages ?? []).map((message, index) => {
                      const isLast =
                        index === (thread.messages ?? []).length - 1;
                      return (
                        <div key={message.id} className="relative py-2 group">
                          {!isLast && (
                            <div className="absolute top-5 left-3 h-full w-px bg-border" />
                          )}
                          <div className="flex items-center gap-2">
                            <div className="relative z-10 size-6 rounded-full bg-muted" />
                            <span className="text-sm font-semibold">
                              {message.authorName ?? 'Unknown'}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatTimestamp(message.createdAt)}
                              {message.updatedAt && ' (edited)'}
                            </span>
                            {message.authorId === currentUser?.id &&
                              editingMessageId !== message.id && (
                                <div className="ml-auto flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                                  <button
                                    type="button"
                                    onClick={() => handleEditMessage(message.id)}
                                    className="inline-flex h-7 w-7 items-center justify-center rounded-md text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                                  >
                                    <Pencil className="size-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleDeleteMessage(message.id)
                                    }
                                    className="inline-flex h-7 w-7 items-center justify-center rounded-md text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                                  >
                                    <Trash2 className="size-4" />
                                  </button>
                                </div>
                              )}
                          </div>

                          <div className="mt-1 pl-8">
                            {editingMessageId === message.id ? (
                              <div className="flex flex-col gap-2">
                                <textarea
                                  className="min-h-[60px] w-full resize-y rounded-md border bg-background p-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                  value={editingValue}
                                  onChange={(event) =>
                                    setEditingValue(event.target.value)
                                  }
                                  autoFocus
                                />
                                <div className="flex justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingMessageId(null);
                                      setEditingValue('');
                                    }}
                                    className="rounded-md border border-input bg-transparent px-3 py-1.5 text-sm text-muted-foreground shadow-sm transition-colors hover:bg-accent"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    onClick={handleSubmitEdit}
                                    disabled={!editingValue.trim()}
                                    className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white shadow-sm transition-colors hover:bg-blue-600/90 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    Save
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <p className="whitespace-pre-wrap text-foreground/80">
                                {message.body}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : null}

            <div className="flex flex-col gap-2">
              <textarea
                className="min-h-[60px] w-full resize-y rounded-md border bg-background p-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                placeholder={
                  thread?.messages?.length
                    ? 'Reply…'
                    : 'Add a comment…'
                }
                value={replyValue}
                onChange={(event) => setReplyValue(event.target.value)}
              />
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="rounded-md border border-input bg-transparent px-3 py-1.5 text-sm text-muted-foreground shadow-sm transition-colors hover:bg-accent"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={handleReplySubmit}
                  disabled={disableReply}
                  className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white shadow-sm transition-colors hover:bg-blue-600/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {thread?.messages?.length ? 'Reply' : 'Comment'}
                </button>
                {thread?.messages?.[0]?.authorId === currentUser?.id && (
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
          </div>
        ) : null}
      </div>
    </PortalBody>
  );
}
