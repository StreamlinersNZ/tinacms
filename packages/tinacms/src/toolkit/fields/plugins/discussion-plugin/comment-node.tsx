'use client';

import * as React from 'react';

import type { TText } from '@udecode/plate';
import type { PlateLeafProps } from '@udecode/plate/react';

import { getCommentCount, getDraftCommentKey } from '@udecode/plate-comments';
import { PlateLeaf, useEditorPlugin, usePluginOption } from '@udecode/plate/react';

import clsx from 'clsx';

import { commentPlugin } from './comment-plugin';

export interface TCommentText extends TText {
  comment?: boolean;
}

export function CommentLeaf(props: PlateLeafProps<TCommentText>) {
  const { children, leaf } = props;

  const { api, setOption } = useEditorPlugin(commentPlugin);
  const hoverId = usePluginOption(commentPlugin, 'hoverId');
  const activeId = usePluginOption(commentPlugin, 'activeId');

  const isDraft = Boolean(leaf[getDraftCommentKey()]);
  const isOverlapping = getCommentCount(leaf) > 1;
  const currentId = api.comment.nodeId(leaf);
  const draftKey = getDraftCommentKey();
  const resolvedId = isDraft ? draftKey : currentId ?? null;

  const isActive = resolvedId
    ? activeId === resolvedId
    : activeId === currentId;
  const isHover = resolvedId
    ? hoverId === resolvedId
    : hoverId === currentId;

  return (
    <PlateLeaf
     
      {...props}
      className={clsx(
        'tina-comment-leaf',
        isDraft && 'tina-comment-leaf--draft',
        isHover && 'tina-comment-leaf--hover',
        isActive && 'tina-comment-leaf--active',
        isOverlapping && 'tina-comment-leaf--overlap'
      )}
      attributes={{
        ...props.attributes,
        'data-comment-leaf': 'true',
        'data-comment-id': resolvedId ?? '',
        'data-comment-state': isDraft
          ? 'draft'
          : isActive
          ? 'active'
          : isHover
          ? 'hover'
          : 'idle',
        'data-comment-overlap': isOverlapping ? 'true' : 'false',
        onClick: () => setOption('activeId', resolvedId ?? currentId ?? null),
        onMouseEnter: () => setOption('hoverId', resolvedId ?? currentId ?? null),
        onMouseLeave: () => setOption('hoverId', null),
      }}
    >
      {children}
    </PlateLeaf>
  );
}
