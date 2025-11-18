'use client';

import { createPlatePlugin } from '@udecode/plate/react';

import type { DiscussionUser, TDiscussion } from '../types';
import { BlockDiscussion } from '../components/block-discussion';
import { AnnotationPopover } from '../components/annotation-popover';

export interface DiscussionPluginOptions {
  discussions: TDiscussion[];
  users: Record<string, DiscussionUser>;
  currentUserId: string;
}

export const discussionPlugin = createPlatePlugin({
  key: 'discussion',  
  options: {
    currentUserId: 'anonymous',
    discussions: [],
    users: {},
  } satisfies DiscussionPluginOptions,

}).configure({
  // Renders the "Block discussion icon" above the nodes
    render: { aboveNodes: BlockDiscussion },
  }).extendSelectors(({ getOption }) => ({
  currentUser: () => getOption('users')[getOption('currentUserId')],
  user: (id: string) => getOption('users')[id],
}));

export type DiscussionPlugin = typeof discussionPlugin;
