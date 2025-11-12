'use client';

import React from 'react';

import { formatDistanceToNow } from 'date-fns';

import { cn } from '@udecode/cn';
import { usePluginOption } from '@udecode/plate/react';

import { valueToPlainText } from './discussion-adapter';
import type { TComment } from './types';
import { discussionPlugin } from './discussion-plugin';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '../mdx-field-plugin/plate/components/plate-ui/avatar';

export function CommentCard({
  comment,
  className,
}: {
  comment: TComment;
  className?: string;
}) {
  const user = usePluginOption(discussionPlugin, 'user', comment.userId);
  const displayName = user?.name ?? comment.userId ?? 'Anonymous';

  return (
    <div className={cn('flex gap-2 py-2', className)}>
      <Avatar className="size-8">
        <AvatarImage alt={displayName} src={user?.avatarUrl} />
        <AvatarFallback>{displayName[0]}</AvatarFallback>
      </Avatar>
      <div className="flex flex-col text-sm text-foreground">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">{displayName}</span>
          <span>
            {formatDistanceToNow(comment.createdAt, {
              addSuffix: true,
            })}
          </span>
          {comment.isEdited && <span>(edited)</span>}
        </div>
        <div className="whitespace-pre-wrap">
          {valueToPlainText(comment.contentRich)}
        </div>
      </div>
    </div>
  );
}
