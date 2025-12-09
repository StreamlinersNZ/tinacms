import * as React from 'react';

import { cn } from '@udecode/cn';

import type { CommentThread } from '../plugins/comment-plugin';
import { CommentMessage } from './comment-message';

export const ThreadSubject = ({
  subject,
}: {
  subject?: string | null;
}) => {
  if (!subject) return null;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-sm font-medium text-foreground">Subject</div>
      <blockquote className="rounded-md border-l-4 border-blue-500 bg-blue-500/10 p-3 text-sm text-foreground">
        {subject}
      </blockquote>
    </div>
  );
};

export interface ThreadMessagesProps {
  messages?: CommentThread['messages'];
  currentUserId?: string;
  editingMessageId?: string | null;
  editingValue?: string;
  onEdit?: (messageId: string) => void;
  onDelete?: (messageId: string) => void;
  onSubmitEdit?: () => void;
  onCancelEdit?: () => void;
  onEditingValueChange?: (value: string) => void;
  containerClassName?: string;
  scrollAreaClassName?: string;
  header?: string;
}

export const ThreadMessages = ({
  messages,
  currentUserId,
  editingMessageId,
  editingValue,
  onEdit,
  onDelete,
  onSubmitEdit,
  onCancelEdit,
  onEditingValueChange,
  containerClassName,
  scrollAreaClassName,
  header = 'Discussion',
}: ThreadMessagesProps) => {
  if (!messages?.length) {
    return null;
  }

  return (
    <div className={cn('flex flex-col gap-1.5', containerClassName)}>
      {header ? <div className="text-sm font-medium">{header}</div> : null}
      <div className={cn('max-h-[280px] overflow-y-auto', scrollAreaClassName)}>
        <div className="flex flex-col">
          {messages.map((message, index) => {
            const isLast = index === messages.length - 1;
            const isEditing = editingMessageId === message.id;
            return (
              <CommentMessage
                key={message.id}
                id={message.id}
                body={message.body}
                authorId={message.authorId}
                authorName={message.authorName}
                createdAt={message.createdAt}
                updatedAt={message.updatedAt}
                currentUserId={currentUserId}
                isLast={isLast}
                onEdit={onEdit ? () => onEdit(message.id ?? '') : undefined}
                onDelete={onDelete ? () => onDelete(message.id ?? '') : undefined}
                isEditing={isEditing}
                editingValue={isEditing ? editingValue : undefined}
                onEditingValueChange={onEditingValueChange}
                onSubmitEdit={onSubmitEdit}
                onCancelEdit={onCancelEdit}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};
