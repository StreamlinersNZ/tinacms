'use client';

import type { Value } from '@udecode/plate';

export interface DiscussionUser {
  id: string;
  name: string;
  avatarUrl?: string;
  hue?: number;
}

export interface TComment {
  id: string;
  contentRich: Value;
  createdAt: Date;
  updatedAt?: Date;
  discussionId: string;
  isEdited: boolean;
  userId: string;
}

export interface TDiscussion {
  id: string;
  comments: TComment[];
  createdAt: Date;
  updatedAt?: Date;
  isResolved: boolean;
  userId: string;
  documentContent?: string;
  discussionSubject?: string;
}
