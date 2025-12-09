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
} from '../../discussion-plugin/utils/annotation-util';
import { Button } from '../../../mdx-field-plugin/plate/components/plate-ui/button';
import { discussionPlugin } from '../../discussion-plugin/plugins/discussion-plugin';
import type { TDiscussion } from '../../discussion-plugin/types';
import {
  useAnnotationThreads,
  useAnnotationUser,
} from '../../discussion-plugin/hooks/use-annotation-state';

export function SuggestionCard({
  suggestionId,
  className,
}: {
  suggestionId: string;
  className?: string;
}) {
  const { editor } = useEditorPlugin(SuggestionPlugin);
  const { editor: discussionEditor } = useEditorPlugin(discussionPlugin);
  const { deleteThread } = useAnnotationThreads();
  const annotationUser = useAnnotationUser();
  const currentUserId = annotationUser?.id;
  const currentUserName =
    annotationUser?.name ||
    (usePluginOption(discussionPlugin, 'user', annotationUser?.id)?.name as
      | string
      | undefined);

  const diff = React.useMemo(
    () => getSuggestionDiff(editor, suggestionId),
    [editor, suggestionId]
  );

  if (!diff) return null;

  const handleAccept = () => {
    if (!currentUserId) return;
    acceptActiveSuggestion({
      editor,
      suggestionId,
      diff,
      userId: currentUserId,
      userName: currentUserName,
    });
    clearCommentThread(editor, suggestionId);
    deleteThread(suggestionId);
    const next = (
      discussionEditor.getOption(discussionPlugin, 'discussions') ?? []
    ).filter((discussion: TDiscussion) => discussion.id !== suggestionId);
    discussionEditor.setOption(discussionPlugin, 'discussions', next);
  };

  const handleReject = () => {
    if (!currentUserId) return;
    rejectActiveSuggestion({
      editor,
      suggestionId,
      diff,
      userId: currentUserId,
      userName: currentUserName,
    });
    clearCommentThread(editor, suggestionId);
    deleteThread(suggestionId);
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
