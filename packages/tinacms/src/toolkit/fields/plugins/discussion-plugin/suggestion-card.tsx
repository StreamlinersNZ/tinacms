'use client';

import React from 'react';

import { CheckIcon, XIcon } from 'lucide-react';

import { cn } from '@udecode/cn';
import { useEditorPlugin, usePluginOption } from '@udecode/plate/react';
import { SuggestionPlugin } from '@udecode/plate-suggestion/react';

import {
  acceptActiveSuggestion,
  clearCommentThread,
  getSuggestionDiff,
  rejectActiveSuggestion,
} from './annotation-util';
import { Button } from '../mdx-field-plugin/plate/components/plate-ui/button';
import { discussionPlugin } from './discussion-plugin';
import type { TDiscussion } from './types';

export function SuggestionCard({
  suggestionId,
  className,
}: {
  suggestionId: string;
  className?: string;
}) {
  const { editor } = useEditorPlugin(SuggestionPlugin);
  const { editor: discussionEditor } = useEditorPlugin(discussionPlugin);
  const currentUserId =
    (usePluginOption(discussionPlugin, 'currentUserId') as string) ??
    'anonymous';

  const diff = React.useMemo(
    () => getSuggestionDiff(editor, suggestionId),
    [editor, suggestionId]
  );

  if (!diff) return null;

  const handleAccept = () => {
    acceptActiveSuggestion({
      editor,
      suggestionId,
      diff,
      userId: currentUserId,
    });
    clearCommentThread(editor, suggestionId);
    const next = (
      discussionEditor.getOption(discussionPlugin, 'discussions') ?? []
    ).filter((discussion: TDiscussion) => discussion.id !== suggestionId);
    discussionEditor.setOption(discussionPlugin, 'discussions', next);
  };

  const handleReject = () => {
    rejectActiveSuggestion({
      editor,
      suggestionId,
      diff,
      userId: currentUserId,
    });
    clearCommentThread(editor, suggestionId);
    const next = (
      discussionEditor.getOption(discussionPlugin, 'discussions') ?? []
    ).filter((discussion: TDiscussion) => discussion.id !== suggestionId);
    discussionEditor.setOption(discussionPlugin, 'discussions', next);
  };

  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-md border border-border bg-background p-4',
        className
      )}
    >
      {diff.deletedText && (
        <div className="text-sm">
          <span className="font-semibold text-destructive">Delete:</span>{' '}
          {diff.deletedText}
        </div>
      )}
      {diff.insertedText && (
        <div className="text-sm">
          <span className="font-semibold text-emerald-600">Add:</span>{' '}
          {diff.insertedText}
        </div>
      )}
      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          className="flex-1"
          onClick={handleAccept}
        >
          <CheckIcon className="mr-1 size-4" />
          Accept
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={handleReject}
        >
          <XIcon className="mr-1 size-4" />
          Reject
        </Button>
      </div>
    </div>
  );
}
