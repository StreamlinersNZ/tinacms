'use client';

import React from 'react';
import { useEditorPlugin } from '@udecode/plate/react';

import {
  CommentInput,
  SuggestionDiff,
  ThreadMessages,
  ThreadSubject,
} from '.';
import {
  commentPlugin,
  type CommentThread,
} from '../plugins/comment-plugin';
import { suggestionPlugin } from '../../suggestion-plugin/suggestion-plugin';
import {
  appendMessageToThread,
  getSuggestionDiff,
  acceptActiveSuggestion,
  rejectActiveSuggestion,
  clearCommentThread,
} from '../utils/annotation-util';
import {
  useAnnotationThreads,
  useAnnotationUser,
} from '../hooks/use-annotation-state';

interface BlockThreadViewProps {
  threadId: string;
  isSuggestion?: boolean;
}

export function BlockThreadView({ threadId, isSuggestion = false }: BlockThreadViewProps) {
  const { editor, setOption: setCommentOption } = useEditorPlugin(commentPlugin);
  const { setOption: setSuggestionOption } = useEditorPlugin(suggestionPlugin);
  const currentUser = useAnnotationUser();
  const { getThreads, commitThread: commitThreadUpdate, deleteThread } =
    useAnnotationThreads();

  // Get comments directly from plugin options (single source of truth)
  const comments = getThreads();
  const [replyValue, setReplyValue] = React.useState('');
  const [editingMessageId, setEditingMessageId] = React.useState<string | null>(null);
  const [editingValue, setEditingValue] = React.useState('');

  const thread: CommentThread | null = comments[threadId] ?? null;

  const suggestionDiff = React.useMemo(() => {
    if (!isSuggestion) return null;
    return getSuggestionDiff(editor, threadId);
  }, [editor, threadId, isSuggestion]);

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

    deleteThread(threadId);
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

    deleteThread(threadId);
    clearCommentThread(editor, threadId);
    setSuggestionOption('activeId', null);
    setCommentOption('activeId', null);
  };

  const handleDeleteThread = () => {
    deleteThread(threadId);

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

      <ThreadSubject subject={thread?.discussionSubject} />

      <ThreadMessages
        messages={thread?.messages}
        currentUserId={currentUser?.id}
        editingMessageId={editingMessageId}
        editingValue={editingValue}
        onEdit={handleEditMessage}
        onDelete={handleDeleteMessage}
        onEditingValueChange={setEditingValue}
        onSubmitEdit={handleSubmitEdit}
        onCancelEdit={() => {
          setEditingMessageId(null);
          setEditingValue('');
        }}
      />

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
