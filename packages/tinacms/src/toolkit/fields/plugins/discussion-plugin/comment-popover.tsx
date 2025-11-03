'use client';

import React from 'react';

import { PortalBody, cn } from '@udecode/cn';
import { NodeApi } from '@udecode/plate';
import { BaseCommentsPlugin, getCommentKey, getDraftCommentKey } from '@udecode/plate-comments';
import { useEditorPlugin, usePluginOption } from '@udecode/plate/react';
import { useCMS } from '@toolkit/react-core';
import { Pencil, Trash2 } from 'lucide-react';

import { commentPlugin, type CommentMessage, type CommentThread } from './comment-plugin';

const DRAFT_KEY = getDraftCommentKey();

const createId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `comment-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
};

const formatTimestamp = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const now = new Date();
  const diffSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) return `${diffSeconds}s ago`;
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const collectHighlightedSubject = (draftEntries: Array<[any, any]>) => {
  const parts = draftEntries
    .map(([node]) => {
      const text = NodeApi.string(node) ?? '';
      return text.replace(/\s+/g, ' ').trim();
    })
    .filter(Boolean);

  const subject = parts.join(' ').replace(/\s+/g, ' ').trim();
  return subject;
};

export function CommentPopover() {
  const cms = useCMS();
  const { api, editor, setOption } = useEditorPlugin(commentPlugin);

  const activeId = usePluginOption(commentPlugin, 'activeId');
  const comments = usePluginOption(commentPlugin, 'comments') ?? {};
  const draftState = usePluginOption(commentPlugin, 'draft');

  const [currentUser, setCurrentUser] = React.useState<{
    id?: string;
    name?: string;
  } | null>(null);

  React.useEffect(() => {
    void cms.api.tina.authProvider.getUser().then((user) => {
      if (!user) throw new Error('User not found');

      setCurrentUser({
        id: user.id ?? user.email,
        name: user.name ?? user.email,
      });
    });
  }, [cms.api.tina.authProvider]);

  const [inputValue, setInputValue] = React.useState('');
  const [replyValue, setReplyValue] = React.useState('');
  const [editingMessageId, setEditingMessageId] = React.useState<string | null>(null);
  const [editingValue, setEditingValue] = React.useState('');

  React.useEffect(() => {
    if (activeId === DRAFT_KEY) {
      setInputValue(draftState?.text ?? '');
      setReplyValue('');
    } else {
      setInputValue('');
      setReplyValue('');
    }
  }, [activeId, draftState?.text]);

  const [position, setPosition] = React.useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  React.useEffect(() => {
    if (!activeId) {
      setPosition(null);
      return;
    }

    const selector = `[data-comment-leaf="true"][data-comment-id="${activeId}"]`;
    const element = document.querySelector<HTMLElement>(selector);
    if (!element) {
      setPosition(null);
      return;
    }

    const update = () => {
      const rect = element.getBoundingClientRect();
      setPosition({
        top: window.scrollY + rect.bottom + 8,
        left: window.scrollX + rect.left,
        width: rect.width,
      });
    };

    update();

    const resizeObserver = new ResizeObserver(update);
    resizeObserver.observe(element);

    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [activeId, editor]);

  if (!activeId || !position) return null;

  const thread =
    activeId === DRAFT_KEY ? null : ((comments?.[activeId] as CommentThread | undefined) ?? null);

  const resetEditingState = () => {
    setEditingMessageId(null);
    setEditingValue('');
  };

  const handleCancelDraft = () => {
    const draftEntries = api.comment.nodes({ isDraft: true });

    if (draftEntries.length) {
      editor.tf.withoutNormalizing(() => {
        draftEntries.forEach(([, path]) => {
          editor.tf.unsetNodes(DRAFT_KEY, { at: path });
          editor.tf.unsetNodes(BaseCommentsPlugin.key, { at: path });
        });
      });
    }

    setOption('draft', null);
    setOption('activeId', null);
    resetEditingState();
  };

  const handleSubmitDraft = () => {
    const value = inputValue.trim();
    if (!value) return;

    const draftEntries = api.comment.nodes({ isDraft: true });
    if (!draftEntries.length) return;

    const threadId = createId();
    const timestamp = new Date().toISOString();
    const discussionSubject = collectHighlightedSubject(draftEntries);

    const initialMessage: CommentMessage = {
      id: createId(),
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
            [getCommentKey(threadId)]: nextThread,
          },
          { at: path }
        );
        editor.tf.unsetNodes(DRAFT_KEY, { at: path });
      });
    });

    setOption('comments', {
      ...comments,
      [threadId]: nextThread,
    });
    setOption('draft', null);
    setOption('activeId', threadId);
  };

  const handleDeleteMessage = (messageId: string) => {
    if (!thread) return;
    const updatedMessages = thread.messages?.filter((message) => message.id !== messageId) ?? [];
    const updatedThread: CommentThread = {
      ...thread,
      messages: updatedMessages,
    };

    commitThreadUpdate(updatedThread);
    if (editingMessageId === messageId) {
      resetEditingState();
    }
  };

  const commitThreadUpdate = (nextThread: CommentThread) => {
    const commentEntries = api.comment.nodes({ id: nextThread.id });
    editor.tf.withoutNormalizing(() => {
      commentEntries.forEach(([, path]) => {
        editor.tf.setNodes(
          {
            [getCommentKey(nextThread.id)]: nextThread,
          },
          { at: path }
        );
      });
    });

    setOption('comments', {
      ...comments,
      [nextThread.id]: nextThread,
    });
  };

  const handleDeleteThread = () => {
    if (!thread) return;

    editor.getTransforms(commentPlugin).comment.unsetMark?.({ id: thread.id });
    const { [thread.id]: _removed, ...rest } = comments;
    setOption('comments', rest);
    setOption('activeId', null);
    resetEditingState();
  };

  const handleReplySubmit = () => {
    if (!thread) return;

    const value = replyValue.trim();
    if (!value) return;

    const timestamp = new Date().toISOString();

    const reply: CommentMessage = {
      id: createId(),
      body: value,
      createdAt: timestamp,
      authorId: currentUser?.id,
      authorName: currentUser?.name,
    };

    const updatedThread: CommentThread = {
      ...thread,
      messages: [...(thread.messages ?? []), reply],
      updatedAt: timestamp,
    };

    commitThreadUpdate(updatedThread);
    setReplyValue('');
  };

  const handleEditMessage = (messageId: string) => {
    if (!thread) return;
    const message = thread.messages?.find((item) => item.id === messageId);
    if (!message) return;
    setEditingMessageId(messageId);
    setEditingValue(message.body ?? '');
  };

  const handleCancelEdit = () => {
    resetEditingState();
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
    resetEditingState();
  };

  return (
    <PortalBody>
      <div
        className={cn(
          'absolute z-[999998] w-[380px] rounded-lg border bg-popover p-4 shadow-xl print:hidden'
        )}
        style={{
          top: position.top,
          left: position.left,
        }}
        data-comment-popover="true"
        onMouseDown={(event) => event.stopPropagation()}
      >
        {activeId === DRAFT_KEY ? (
          <div className="flex flex-col gap-3">
            <textarea
              className="min-h-[80px] w-full resize-y rounded-md border bg-background p-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              placeholder="Add a comment…"
              value={inputValue}
              onChange={(event) => {
                setInputValue(event.target.value);
                setOption('draft', { text: event.target.value });
              }}
              autoFocus
              data-comment-popover-textarea="true"
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
                disabled={!inputValue.trim()}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white shadow-sm transition-colors hover:bg-blue-600/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Comment
              </button>
            </div>
          </div>
        ) : thread ? (
          <div className="flex flex-col gap-4">
            {thread.discussionSubject && (
              <div className="flex flex-col gap-1.5">
                <div className="text-sm font-medium text-foreground">Subject</div>
                <blockquote className="rounded-md border-l-4 border-blue-500 bg-blue-500/10 p-3 text-sm text-foreground">
                  {thread.discussionSubject}
                </blockquote>
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <div className="text-sm font-medium">Discussion</div>
              <div className="max-h-[280px] overflow-y-auto">
                <div className="flex flex-col">
                  {(thread.messages ?? []).map((message, index) => {
                    const isLast = index === (thread.messages ?? []).length - 1;
                    return (
                      <div key={message.id} className="relative py-2 group">
                        {!isLast && (
                          <div className="absolute top-5 left-3 h-full w-px bg-border" />
                        )}
                        <div className="flex items-center gap-2">
                          <div className="relative z-10 size-6 rounded-full bg-muted" />
                          <span className="font-semibold text-sm">
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
                                  onClick={() =>
                                    handleEditMessage(message.id)
                                  }
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

                        <div className="pl-8 mt-1">
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
                                  onClick={handleCancelEdit}
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
            <div className="flex flex-col gap-2">
              <textarea
                className="min-h-[60px] w-full resize-y rounded-md border bg-background p-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                placeholder="Reply…"
                value={replyValue}
                onChange={(event) => setReplyValue(event.target.value)}
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setOption('activeId', null);
                    resetEditingState();
                  }}
                  className="rounded-md border border-input bg-transparent px-3 py-1.5 text-sm text-muted-foreground shadow-sm transition-colors hover:bg-accent"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={handleReplySubmit}
                  disabled={!replyValue.trim()}
                  className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white shadow-sm transition-colors hover:bg-blue-600/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Reply
                </button>
                {(!thread.messages?.[0]?.authorId ||
                  thread.messages?.[0]?.authorId === currentUser?.id) && (
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
