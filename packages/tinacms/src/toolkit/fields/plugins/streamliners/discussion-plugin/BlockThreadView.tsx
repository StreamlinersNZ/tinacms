'use client';

import React from 'react';
import { useEditorPlugin, usePluginOption } from '@udecode/plate/react';
import { useCMS } from '@toolkit/react-core';

import { CommentMessage, CommentInput, SuggestionDiff } from './shared';
import {
  commentPlugin,
  type CommentThread,
} from './comment-plugin';
import { suggestionPlugin } from '../suggestion-plugin/suggestion-plugin';
import {
  appendMessageToThread,
  getSuggestionDiff,
  acceptActiveSuggestion,
  rejectActiveSuggestion,
  clearCommentThread,
} from './annotation-util';
import type { StoredSuggestion } from './annotations-store';

interface BlockThreadViewProps {
  threadId: string;
  isSuggestion?: boolean;
}

type CurrentUser = { id?: string; name?: string } | null;

export function BlockThreadView({ threadId, isSuggestion = false }: BlockThreadViewProps) {
  const cms = useCMS();
  const { editor, setOption: setCommentOption } = useEditorPlugin(commentPlugin);
  const { setOption: setSuggestionOption } = useEditorPlugin(suggestionPlugin);

  // Get comments directly from plugin options (single source of truth)
  const comments = (editor.getOption(commentPlugin, 'threads') || {}) as Record<string, CommentThread>;

  const [currentUser, setCurrentUser] = React.useState<CurrentUser>(null);
  const [replyValue, setReplyValue] = React.useState('');
  const [editingMessageId, setEditingMessageId] = React.useState<string | null>(null);
  const [editingValue, setEditingValue] = React.useState('');

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

  const thread: CommentThread | null = comments[threadId] ?? null;

  const suggestionDiff = React.useMemo(() => {
    if (!isSuggestion) return null;
    return getSuggestionDiff(editor, threadId);
  }, [editor, threadId, isSuggestion]);

  const commitThreadUpdate = React.useCallback(
    (nextThread: CommentThread) => {
      const currentThreads = editor.getOption(commentPlugin, 'threads') || {};
      editor.setOption(commentPlugin, 'threads', {
        ...currentThreads,
        [nextThread.id]: nextThread,
      });
    },
    [editor]
  );

  const handleReplySubmit = () => {
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

    commitThreadUpdate(updatedThread);
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
    if (!suggestionDiff) return;
    acceptActiveSuggestion({
      editor,
      suggestionId: threadId,
      diff: suggestionDiff,
      userId: currentUser?.id,
    });

    const currentThreads = editor.getOption(commentPlugin, 'threads') || {};
    if (currentThreads[threadId]) {
      const { [threadId]: _removed, ...rest } = currentThreads;
      editor.setOption(commentPlugin, 'threads', rest);
    }
    if (isSuggestion && suggestionDiff) {
      clearCommentThread(editor, threadId);
      setSuggestionOption('activeId', null);
    }
    setCommentOption('activeId', null);
  };

  const handleRejectSuggestion = () => {
    if (!suggestionDiff) return;
    rejectActiveSuggestion({
      editor,
      suggestionId: threadId,
      diff: suggestionDiff,
      userId: currentUser?.id,
    });

    const currentThreads = editor.getOption(commentPlugin, 'threads') || {};
    if (currentThreads[threadId]) {
      const { [threadId]: _removed, ...rest } = currentThreads;
      editor.setOption(commentPlugin, 'threads', rest);
    }
    clearCommentThread(editor, threadId);
    setSuggestionOption('activeId', null);
    setCommentOption('activeId', null);
  };

  const handleDeleteThread = () => {
    editor.getTransforms(commentPlugin).comment.unsetMark?.({
      id: threadId,
    });

    const currentThreads = editor.getOption(commentPlugin, 'threads') || {};
    if (currentThreads[threadId]) {
      const { [threadId]: _removed, ...rest } = currentThreads;
      editor.setOption(commentPlugin, 'threads', rest);
    }

    if (isSuggestion && suggestionDiff) {
      clearCommentThread(editor, threadId);
      setSuggestionOption('activeId', null);
    }
    setCommentOption('activeId', null);
  };

  return (
    <div className="p-4 flex flex-col gap-4">
      {suggestionDiff && (
        <SuggestionDiff
          deletedText={suggestionDiff.deletedText}
          insertedText={suggestionDiff.insertedText}
          onAccept={handleAcceptSuggestion}
          onReject={handleRejectSuggestion}
        />
      )}

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
                const isLast = index === (thread.messages ?? []).length - 1;
                return (
                  <CommentMessage
                    key={message.id}
                    id={message.id}
                    body={message.body}
                    authorId={message.authorId}
                    authorName={message.authorName}
                    createdAt={message.createdAt}
                    updatedAt={message.updatedAt}
                    currentUserId={currentUser?.id}
                    isLast={isLast}
                    onEdit={handleEditMessage}
                    onDelete={handleDeleteMessage}
                    isEditing={editingMessageId === message.id}
                    editingValue={editingValue}
                    onEditingValueChange={setEditingValue}
                    onSubmitEdit={handleSubmitEdit}
                    onCancelEdit={() => {
                      setEditingMessageId(null);
                      setEditingValue('');
                    }}
                  />
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      <CommentInput
        value={replyValue}
        onChange={setReplyValue}
        onSubmit={handleReplySubmit}
        placeholder={thread?.messages?.length ? 'Reply…' : 'Add a comment…'}
        submitLabel={thread?.messages?.length ? 'Reply' : 'Comment'}
        minHeight="60px"
      />

      {thread?.messages?.[0]?.authorId === currentUser?.id || thread?.messages?.[0]?.authorId === 'anonymous' || thread?.messages?.[0]?.authorId === undefined && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleDeleteThread}
            className="rounded-md border border-destructive bg-transparent px-3 py-1.5 text-sm text-destructive shadow-sm transition-colors hover:bg-destructive hover:text-destructive-foreground"
          >
            Delete Thread
          </button>
        </div>
      )}
    </div>
  );
}
