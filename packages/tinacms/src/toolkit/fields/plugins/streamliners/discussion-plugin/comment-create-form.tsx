'use client';

import React from 'react';

import { nanoid } from '@udecode/plate';
import { cn } from '@udecode/cn';

import {
  useEditorPlugin,
  usePluginOption,
} from '@udecode/plate/react';

import { Button } from '../../mdx-field-plugin/plate/components/plate-ui/button';
import { commentPlugin } from './comment-plugin';
import { discussionPlugin } from './discussion-plugin';
import {
  discussionsToCommentThreads,
  textToValue,
} from './discussion-adapter';
import type { TComment, TDiscussion } from './types';

const isDev = process.env.NODE_ENV !== 'production';

export function CommentCreateForm({
  discussionId,
  placeholder = 'Reply...',
  autoFocus,
}: {
  discussionId?: string;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const [value, setValue] = React.useState('');
  const { editor: commentEditor, setOption: setCommentOption } = useEditorPlugin(commentPlugin);
  const { setOption: setDiscussionOption } = useEditorPlugin(discussionPlugin);
  const discussions =
    (usePluginOption(discussionPlugin, 'discussions') as TDiscussion[]) ?? [];
  const currentUserId =
    (usePluginOption(discussionPlugin, 'currentUserId') as string) ??
    'anonymous';

  const submit = () => {
    const body = value.trim();
    if (!body) return;

    const nextComment: TComment = {
      id: nanoid(),
      contentRich: textToValue(body),
      createdAt: new Date(),
      discussionId: discussionId ?? nanoid(),
      isEdited: false,
      userId: currentUserId,
    };

    // Threads are now created immediately by the toolbar button,
    // so this form is only used for adding messages to existing threads
    if (!discussionId) return;

    const nextDiscussions = discussions.map((discussion) =>
      discussion.id === discussionId
        ? {
            ...discussion,
            comments: [...discussion.comments, nextComment],
            updatedAt: new Date(),
          }
        : discussion
    );

    setDiscussionOption('discussions', nextDiscussions);

    // Update comment threads directly in plugin options
    const nextThreads = discussionsToCommentThreads(nextDiscussions);
    commentEditor.setOption(commentPlugin, 'threads', nextThreads);

    setCommentOption('activeId', nextComment.discussionId);
    if (isDev) {
      console.debug('[CommentCreateForm] submitted comment', {
        discussionId: nextComment.discussionId,
        hasExistingThread: Boolean(discussionId),
        totalDiscussions: nextDiscussions.length,
      });
    }
    setValue('');
  };

  return (
    <div className="flex flex-col gap-2">
      <textarea
        autoFocus={autoFocus}
        className={cn(
          'min-h-[80px] w-full resize-y rounded-md border border-input bg-background p-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        )}
        placeholder={placeholder}
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
      <div className="flex justify-end">
        <Button
          variant="secondary"
          size="sm"
          disabled={!value.trim()}
          onClick={submit}
        >
          Send
        </Button>
      </div>
    </div>
  );
}
