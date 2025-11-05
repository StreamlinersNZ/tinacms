'use client';

import React from 'react';

import { PortalBody, cn } from '@udecode/cn';
import { ElementApi, TextApi, type Path } from '@udecode/plate';
import {
  acceptSuggestion,
  getSuggestionKey,
  rejectSuggestion,
  type TResolvedSuggestion,
} from '@udecode/plate-suggestion';
import {
  type PlateEditor,
  useEditorPlugin,
  usePluginOption,
} from '@udecode/plate/react';
import { BaseCommentsPlugin, getCommentKey } from '@udecode/plate-comments';
import { useCMS } from '@toolkit/react-core';

import type { SuggestionDiff } from './suggestion-plugin';
import {
  commentPlugin,
  type CommentMessage,
  type CommentThread,
} from '../discussion-plugin/comment-plugin';
import { suggestionPlugin } from './suggestion-plugin';

const createClientId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `suggestion-comment-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
};

export function SuggestionPopover() {
  console.log('[SuggestionPopover] rendering');
  const cms = useCMS();
  const { editor, setOption: setSuggestionOption } = useEditorPlugin(suggestionPlugin);
  const { setOption: setCommentOption } = useEditorPlugin(commentPlugin);

  const activeId = usePluginOption(suggestionPlugin, 'activeId') as string | null;
  console.log('[SuggestionPopover] render hook', { activeId });
  const comments =
    (usePluginOption(commentPlugin, 'comments') as Record<string, CommentThread>) ?? {};
  const [currentUser, setCurrentUser] = React.useState<{ id?: string; name?: string } | null>(null);

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

  React.useEffect(() => {
    if (!activeId) {
      console.log('[SuggestionPopover] no active suggestion');
      setPosition(null);
      return;
    }

    const selector = `[data-suggestion-leaf="true"][data-suggestion-id="${activeId}"]`;
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

    const observer = new ResizeObserver(update);
    observer.observe(element);
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);

    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [activeId]);

  const diff = React.useMemo(
    () => (activeId ? getSuggestionDiff(editor, activeId) : null),
    [editor, activeId]
  );

  const [commentValue, setCommentValue] = React.useState('');

  React.useEffect(() => {
    setCommentValue('');
  }, [activeId]);

  if (!activeId || !position || !diff) {
    if (activeId) {
      console.log('[SuggestionPopover] missing data', {
        hasPosition: Boolean(position),
        hasDiff: Boolean(diff),
        activeId,
      });
    }
    return null;
  }

  const thread: CommentThread =
    comments[activeId] ?? {
      id: activeId,
      createdAt: new Date().toISOString(),
      messages: [],
    };

  const addComment = () => {
    const value = commentValue.trim();
    if (!value) return;

    const timestamp = new Date().toISOString();
    const newMessage: CommentMessage = {
      id: createClientId(),
      body: value,
      createdAt: timestamp,
      authorId: currentUser?.id,
      authorName: currentUser?.name,
    };

    const updatedThread: CommentThread = {
      ...thread,
      updatedAt: timestamp,
      discussionSubject:
        thread.discussionSubject ?? diff.deletedText ?? diff.insertedText ?? '',
      documentContent: thread.documentContent ?? diff.deletedText ?? diff.insertedText,
      messages: [...(thread.messages ?? []), newMessage],
    };

    setCommentOption('comments', {
      ...comments,
      [activeId]: updatedThread,
    });
    ensureCommentMark(editor, activeId, updatedThread);
    setCommentValue('');
  };

  const buildDescription = () => ({
    createdAt: new Date(),
    keyId: activeId,
    suggestionId: activeId,
    type: diff.type,
    userId: currentUser?.id ?? 'anonymous',
    ...(diff.deletedText ? { text: diff.deletedText } : {}),
    ...(diff.insertedText ? { newText: diff.insertedText } : {}),
  }) as TResolvedSuggestion;

  const handleAccept = () => {
    const suggestionApi = editor.getApi(suggestionPlugin).suggestion;
    suggestionApi.withoutSuggestions(() => {
      acceptSuggestion(editor, buildDescription());
    });

    if (comments[activeId]) {
      const { [activeId]: _removed, ...rest } = comments;
      setCommentOption('comments', rest);
    }
    clearCommentThread(editor, activeId);
    setSuggestionOption('activeId', null);
  };

  const handleReject = () => {
    const suggestionApi = editor.getApi(suggestionPlugin).suggestion;
    suggestionApi.withoutSuggestions(() => {
      rejectSuggestion(editor, buildDescription());
    });

    if (comments[activeId]) {
      const { [activeId]: _removed, ...rest } = comments;
      setCommentOption('comments', rest);
    }
    clearCommentThread(editor, activeId);
    setSuggestionOption('activeId', null);
  };

  return (
    <PortalBody>
      <div
        className={cn(
          'absolute z-[999998] w-[320px] rounded-md border bg-popover p-3 shadow-xl print:hidden'
        )}
        style={{ top: position.top, left: position.left }}
        data-suggestion-popover="true"
      >
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Suggestion
        </div>
        <div className="space-y-2 text-sm text-muted-foreground">
          {diff.deletedText && (
            <div>
              <span className="font-semibold text-red-600">Delete:</span> {diff.deletedText}
            </div>
          )}
          {diff.insertedText && (
            <div>
              <span className="font-semibold text-emerald-600">Add:</span> {diff.insertedText}
            </div>
          )}
        </div>

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={handleAccept}
            className="flex flex-1 items-center justify-center rounded-md border border-emerald-500 px-2 py-1 text-xs font-semibold text-emerald-600 transition hover:bg-emerald-50"
          >
            Accept
          </button>
          <button
            type="button"
            onClick={handleReject}
            className="flex flex-1 items-center justify-center rounded-md border border-destructive px-2 py-1 text-xs font-semibold text-destructive transition hover:bg-destructive/10"
          >
            Reject
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Comments
          </div>
          <div className="flex flex-col gap-2">
            {(thread.messages ?? []).map((message) => (
              <div
                key={message.id}
                className="rounded-md border border-border/60 bg-muted/40 p-2 text-sm text-foreground"
              >
                <div className="mb-1 text-[11px] font-semibold text-muted-foreground">
                  {message.authorName ?? 'Anonymous'} · {new Date(message.createdAt).toLocaleString()}
                </div>
                {message.body}
              </div>
            ))}
          </div>

          <textarea
            className="min-h-[60px] w-full resize-y rounded-md border bg-background p-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="Add a comment…"
            value={commentValue}
            onChange={(event) => setCommentValue(event.target.value)}
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setSuggestionOption('activeId', null)}
              className="rounded-md border px-3 py-1 text-xs text-muted-foreground transition hover:bg-muted"
            >
              Close
            </button>
            <button
              type="button"
              onClick={addComment}
              disabled={!commentValue.trim()}
              className="rounded-md bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground transition enabled:hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Comment
            </button>
          </div>
        </div>
      </div>
    </PortalBody>
  );
}

const getSuggestionDiff = (
  editor: PlateEditor,
  suggestionId: string
): SuggestionDiff | null => {
  if (!suggestionId) return null;
  const suggestionApi = editor.getApi(suggestionPlugin).suggestion;
  const entries = Array.from(
    suggestionApi.nodes({ at: [], mode: 'all' }) as Iterable<[any, Path]>
  );

  let inserted = '';
  let deleted = '';

  for (const [node] of entries) {
    if (TextApi.isText(node)) {
      const dataList = suggestionApi.dataList(node);
      dataList.forEach((data) => {
        if (data.id !== suggestionId) return;
        const text = node.text ?? '';
        if (data.type === 'insert') {
          inserted += text;
        } else if (data.type === 'remove') {
          deleted += text;
        } else if (data.type === 'update') {
          inserted += text;
        }
      });
    } else if (ElementApi.isElement(node)) {
      const suggestionData = suggestionApi.isBlockSuggestion(node)
        ? node.suggestion
        : undefined;
      if (!suggestionData) continue;
      if (suggestionData.id !== suggestionId) continue;
      const label = `[${node.type}]`;
      if (suggestionData.type === 'insert') {
        inserted += label;
      } else {
        deleted += label;
      }
    }
  }

  const normalize = (value: string) => value.replace(/\s+/g, ' ').trim();
  inserted = normalize(inserted);
  deleted = normalize(deleted);

  if (!inserted && !deleted) return null;

  const type: 'insert' | 'remove' | 'replace' | 'update' =
    inserted && deleted ? 'replace' : inserted ? 'insert' : 'remove';

  return {
    insertedText: inserted || undefined,
    deletedText: deleted || undefined,
    type,
  };
};

const ensureCommentMark = (
  editor: PlateEditor,
  suggestionId: string,
  thread: CommentThread
) => {
  const suggestionKey = getSuggestionKey(suggestionId);
  const commentKey = getCommentKey(suggestionId);
  const suggestionApi = editor.getApi(suggestionPlugin).suggestion;
  const entries = Array.from(
    suggestionApi.nodes({ id: suggestionKey, text: true }) as Iterable<[any, Path]>
  );

  editor.tf.withoutNormalizing(() => {
    entries.forEach(([, path]) => {
      editor.tf.setNodes(
        {
          comment: true,
          [commentKey]: thread,
          [BaseCommentsPlugin.key]: true,
        },
        { at: path }
      );
    });
  });
};

const clearCommentThread = (editor: PlateEditor, suggestionId: string) => {
  const suggestionKey = getSuggestionKey(suggestionId);
  const commentKey = getCommentKey(suggestionId);
  const suggestionApi = editor.getApi(suggestionPlugin).suggestion;
  const entries = Array.from(
    suggestionApi.nodes({ id: suggestionKey, text: true }) as Iterable<[any, Path]>
  );

  editor.tf.withoutNormalizing(() => {
    entries.forEach(([, path]) => {
      editor.tf.unsetNodes([BaseCommentsPlugin.key, commentKey, 'comment'], {
        at: path,
      });
    });
  });
  editor.getTransforms(commentPlugin).comment.unsetMark?.({ id: suggestionId });
};
