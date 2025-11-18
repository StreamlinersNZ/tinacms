'use client';

import React from 'react';
import { Pencil, Trash2 } from 'lucide-react';

export interface CommentMessageProps {
  id: string;
  body?: string;
  authorId?: string;
  authorName?: string;
  createdAt: string;
  updatedAt?: string;
  currentUserId?: string;
  isLast?: boolean;
  onEdit?: (messageId: string) => void;
  onDelete?: (messageId: string) => void;
  isEditing?: boolean;
  editingValue?: string;
  onEditingValueChange?: (value: string) => void;
  onSubmitEdit?: () => void;
  onCancelEdit?: () => void;
}

export function CommentMessage({
  id,
  body,
  authorId,
  authorName,
  createdAt,
  updatedAt,
  currentUserId,
  isLast,
  onEdit,
  onDelete,
  isEditing,
  editingValue,
  onEditingValueChange,
  onSubmitEdit,
  onCancelEdit,
}: CommentMessageProps) {
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="relative py-2 group">
      {!isLast && (
        <div className="absolute top-5 left-3 h-full w-px bg-border" />
      )}
      <div className="flex items-center gap-2">
        <div className="relative z-10 size-6 rounded-full bg-muted" />
        <span className="text-sm font-semibold">
          {authorName ?? 'Unknown'}
        </span>
        <span className="text-xs text-muted-foreground">
          {formatTimestamp(createdAt)}
          {updatedAt && ' (edited)'}
        </span>
        {authorId === currentUserId && !isEditing && onEdit && onDelete && (
          <div className="ml-auto flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              type="button"
              onClick={() => onEdit(id)}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <Pencil className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => onDelete(id)}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        )}
      </div>

      <div className="mt-1 pl-8">
        {isEditing ? (
          <div className="flex flex-col gap-2">
            <textarea
              className="min-h-[60px] w-full resize-y rounded-md border bg-background p-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              value={editingValue}
              onChange={(event) => onEditingValueChange?.(event.target.value)}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onCancelEdit}
                className="rounded-md border border-input bg-transparent px-3 py-1.5 text-sm text-muted-foreground shadow-sm transition-colors hover:bg-accent"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onSubmitEdit}
                disabled={!editingValue?.trim()}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white shadow-sm transition-colors hover:bg-blue-600/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
        ) : (
          <p className="whitespace-pre-wrap text-foreground/80">{body}</p>
        )}
      </div>
    </div>
  );
}
