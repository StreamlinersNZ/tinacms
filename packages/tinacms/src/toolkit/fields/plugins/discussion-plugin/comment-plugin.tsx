'use client';

import type { ExtendConfig, Path, SlatePlugin } from '@udecode/plate';
import {
  BaseCommentsPlugin,
  getDraftCommentKey,
  type BaseCommentsConfig,
} from '@udecode/plate-comments';
import { toTPlatePlugin } from '@udecode/plate/react';

import { CommentLeaf } from './comment-node';

export type CommentMessage = {
  id: string;
  body: string;
  createdAt: string;
  updatedAt?: string;
  authorId?: string;
  authorName?: string;
};

export type CommentThread = {
  id: string;
  createdAt: string;
  updatedAt?: string;
  messages: CommentMessage[];
  isResolved?: boolean;
  documentContent?: string;
  discussionSubject?: string;
};

type CommentDraftState = {
  text: string;
};

type CommentPluginConfig = ExtendConfig<
  BaseCommentsConfig,
  {
    activeId: string | null;
    hoverId: string | null;
    comments: Record<string, CommentThread>;
    draft: CommentDraftState | null;
    commentingBlock?: Path | null;
    uniquePathMap: Map<string, Path>;
  }
>;

const baseCommentsPlugin = BaseCommentsPlugin as unknown as SlatePlugin<CommentPluginConfig>;

export const commentPlugin = toTPlatePlugin<CommentPluginConfig>(
  baseCommentsPlugin,
  ({ editor, setOption, tf }) => {
    const commentTransforms = {
      ...(tf.comment ?? {}),
    } as BaseCommentsConfig['transforms']['comment'];
    const originalSetDraft = commentTransforms.setDraft?.bind(commentTransforms);

    commentTransforms.setDraft = (options) => {
      if (!editor.selection) return;

      let blockEntry = editor.api.block();

      if (editor.api.isCollapsed()) {
        if (blockEntry) {
          editor.tf.select(blockEntry[1]);
        }
        blockEntry = editor.api.block() ?? blockEntry;
      }

      originalSetDraft?.(options);
      editor.tf.collapse();
      setOption('draft', { text: '' });
      setOption('activeId', getDraftCommentKey());
      setOption('commentingBlock', blockEntry ? blockEntry[1] : null);
    };

    const options: CommentPluginConfig['options'] = {
      activeId: null,
      hoverId: null,
      comments: {},
      draft: null,
      commentingBlock: null,
      uniquePathMap: new Map(),
    };

    return {
      options,
      render: {
        leaf: CommentLeaf,
      },
      handlers: {
        onClick: ({ event, setOption }) => {
          const target = event.target;
          if (!(target instanceof HTMLElement)) return;

          const markElement = target.closest<HTMLElement>(
            '[data-comment-leaf="true"]'
          );
          if (!markElement) return;

          const commentId = markElement.getAttribute('data-comment-id');
          if (!commentId) {
            setOption('activeId', null);
            setOption('draft', null);
            return;
          }

          setOption('activeId', commentId);
          if (commentId !== getDraftCommentKey()) {
            setOption('draft', null);
          }
        },
      },
      transforms: {
        comment: commentTransforms,
      },
      shortcuts: {
        setDraft: { keys: 'mod+shift+m' },
      },
    };
  }
);

export default commentPlugin;
