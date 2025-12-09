'use client';

import type { ExtendConfig, Path, SlatePlugin } from '@udecode/plate';
import {
  BaseCommentsPlugin,
  type BaseCommentsConfig,
} from '@udecode/plate-comments';
import { toTPlatePlugin } from '@udecode/plate/react';

import { CommentLeaf } from '../components/comment-node';

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

type CommentPluginConfig = ExtendConfig<
  BaseCommentsConfig,
  {
    activeId: string | null;
    hoverId: string | null;
    overlappingIds: string[] | null; // All comment IDs at the clicked location (for handling overlapping comments)
    threads: Record<string, CommentThread>;
    uniquePathMap: Map<string, Path>;
  }
>;

const baseCommentsPlugin = BaseCommentsPlugin as unknown as SlatePlugin<CommentPluginConfig>;

export const commentPlugin = toTPlatePlugin<CommentPluginConfig>(
  baseCommentsPlugin,
  ({ editor, setOption }) => {
    const options: CommentPluginConfig['options'] = {
      activeId: null,
      hoverId: null,
      overlappingIds: null,
      threads: {},
      uniquePathMap: new Map(),
    };

    return {
      options,
      render: {
        leaf: CommentLeaf,
      },
      handlers: {
        onClick: ({ event, setOption, editor }) => {
          const target = event.target;
          if (!(target instanceof HTMLElement)) return;

          const markElement = target.closest<HTMLElement>(
            '[data-comment-leaf="true"]'
          );
          if (!markElement) {
            setOption('activeId', null);
            setOption('overlappingIds', null);
            return;
          }

          const commentId = markElement.getAttribute('data-comment-id');
          if (!commentId) {
            setOption('activeId', null);
            setOption('overlappingIds', null);
            return;
          }

          // Extract all comment IDs from the clicked node
          // Comment marks follow the pattern: comment_<uuid>
          const allCommentIds: string[] = [];

          // Get the Slate node at the clicked location to check for multiple comment marks
          const nodeEntry = editor.api.above({
            match: (node) => editor.api.isText(node),
          });

          if (nodeEntry) {
            const [node] = nodeEntry;
            // Look for all properties that match the comment key pattern
            Object.keys(node).forEach((key) => {
              if (key.startsWith('comment_') && key !== 'comment') {
                const id = key.replace('comment_', '');
                allCommentIds.push(id);
              }
            });
          }

          // If we found multiple comment IDs, store them for overlapping comment handling
          if (allCommentIds.length > 1) {
            setOption('overlappingIds', allCommentIds);
            // Set the primary comment ID as active (prefer the one from data attribute if it's in the list)
            setOption('activeId', allCommentIds.includes(commentId) ? commentId : allCommentIds[0]);
          } else {
            setOption('overlappingIds', null);
            setOption('activeId', commentId);
          }
        },
      },
    };
  }
);

export default commentPlugin;
