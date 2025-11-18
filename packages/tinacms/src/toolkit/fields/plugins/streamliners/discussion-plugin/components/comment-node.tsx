'use client';

import * as React from 'react';

import type { TText } from '@udecode/plate';
import type { PlateLeafProps } from '@udecode/plate/react';

import { getDraftCommentKey } from '@udecode/plate-comments';
import { PlateLeaf, useEditorPlugin, usePluginOption } from '@udecode/plate/react';


import clsx from 'clsx';

import { getCommentIdsFromNode } from '../utils/comment-ids';
import { commentPlugin } from '../plugins/comment-plugin';

export interface TCommentText extends TText {
  comment?: boolean;
}

export function CommentLeaf(props: PlateLeafProps<TCommentText>) {
  const { children, leaf } = props;

  const { setOption } = useEditorPlugin(commentPlugin);
  const hoverId = usePluginOption(commentPlugin, 'hoverId');
  const activeId = usePluginOption(commentPlugin, 'activeId');

  const isDraft = Boolean(leaf[getDraftCommentKey()]);
  const commentIds = React.useMemo(() => getCommentIdsFromNode(leaf), [leaf]);
  const isOverlapping = commentIds.length > 1;
  const currentId = commentIds.at(-1) ?? null;
  const draftKey = getDraftCommentKey();
  const resolvedId = isDraft ? draftKey : currentId ?? null;

  const isActive = resolvedId
    ? activeId === resolvedId
    : activeId === currentId;
  const isHover = resolvedId
    ? hoverId === resolvedId
    : hoverId === currentId;

  const handleClick = () => {
    const nextId = resolvedId ?? currentId ?? null;
    if (process.env.NODE_ENV !== 'production') {
      console.debug('[CommentLeaf] click', {
        nextId,
        isDraft,
        blockState: props.leaf,
      });
    }
    if (commentIds.length > 1) {
      setOption('overlappingIds', commentIds);
    } else {
      setOption('overlappingIds', null);
    }
    setOption('activeId', nextId);
  };

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
        onClick: handleClick,
        onMouseEnter: () => setOption('hoverId', resolvedId ?? currentId ?? null),
        onMouseLeave: () => setOption('hoverId', null),
      }}
    >
      {children}
    </PlateLeaf>
  );
}
