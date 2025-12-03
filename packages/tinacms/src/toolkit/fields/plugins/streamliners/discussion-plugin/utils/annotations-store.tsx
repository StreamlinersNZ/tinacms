'use client';

import React from 'react';

import type { CommentThread } from '../plugins/comment-plugin';
import { areCommentMapsEqual } from './comment-annotations';

export type StoredSuggestion = {
  id: string;
  createdAt: number | string;
  type: 'insert' | 'remove' | 'replace' | 'update' | 'block';
  userId?: string;
  userName?: string;
  status?: 'pending' | 'accepted' | 'rejected';
  resolvedAt?: string;
};

export type AnnotationState = {
  comments: Record<string, CommentThread>;
  suggestions: Record<string, StoredSuggestion>;
};

export const createEmptyAnnotationState = (): AnnotationState => ({
  comments: {},
  suggestions: {},
});

export type CommentsUpdater =
  | Record<string, CommentThread>
  | ((
      previous: Record<string, CommentThread>
    ) => Record<string, CommentThread>);
export type SuggestionsUpdater =
  | Record<string, StoredSuggestion>
  | ((
      previous: Record<string, StoredSuggestion>
    ) => Record<string, StoredSuggestion>);

export type AnnotationsContextValue = {
  annotations: AnnotationState;
  setComments: (updater: CommentsUpdater) => void;
  setSuggestions: (updater: SuggestionsUpdater) => void;
};

const AnnotationsContext = React.createContext<
  AnnotationsContextValue | undefined
>(undefined);

export const AnnotationsProvider = ({
  value,
  children,
}: {
  value: AnnotationsContextValue;
  children: React.ReactNode;
}) => {
  return (
    <AnnotationsContext.Provider value={value}>
      {children}
    </AnnotationsContext.Provider>
  );
};

export const useAnnotationsStore = () => {
  const context = React.useContext(AnnotationsContext);
  if (!context) {
    throw new Error(
      'useAnnotationsStore must be used within an AnnotationsProvider'
    );
  }
  return context;
};

export const normalizeAnnotations = (
  value: Partial<AnnotationState> | null | undefined
): AnnotationState => {
  const comments: Record<string, CommentThread> = {};
  const suggestions: Record<string, StoredSuggestion> = {};

  Object.entries(value?.comments ?? {}).forEach(([id, thread]) => {
    if (!thread) return;
    comments[id] = {
      ...thread,
      id: thread.id ?? id,
      messages: (thread.messages ?? []).map((message, index) => ({
        ...message,
        id: message.id ?? `${id}-message-${index}`,
      })),
    };
  });

  Object.entries(value?.suggestions ?? {}).forEach(([id, suggestion]) => {
    if (!suggestion) return;
    suggestions[id] = {
      ...suggestion,
      id: suggestion.id ?? id,
    };
  });

  return {
    comments,
    suggestions,
  };
};

export const areAnnotationStatesEqual = (
  a: AnnotationState,
  b: AnnotationState
) => {
  if (a === b) return true;
  if (!areCommentMapsEqual(a.comments, b.comments)) return false;
  if (!areSuggestionMapsEqual(a.suggestions, b.suggestions)) return false;
  return true;
};

export const areSuggestionMapsEqual = (
  a: Record<string, StoredSuggestion>,
  b: Record<string, StoredSuggestion>
) => {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;

  for (const key of aKeys) {
    const aValue = a[key];
    const bValue = b[key];
    if (!bValue) return false;
    if (aValue.id !== bValue.id) return false;
    if (aValue.type !== bValue.type) return false;
    if (aValue.createdAt !== bValue.createdAt) return false;
    if (aValue.userId !== bValue.userId) return false;
    if (aValue.userName !== bValue.userName) return false;
    if (aValue.status !== bValue.status) return false;
    if (aValue.resolvedAt !== bValue.resolvedAt) return false;
  }

  return true;
};
