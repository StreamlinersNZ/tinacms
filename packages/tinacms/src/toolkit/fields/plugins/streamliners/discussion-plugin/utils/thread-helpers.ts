import type { CommentMessage, CommentThread } from '../plugins/comment-plugin';
import { createAnnotationId } from './annotation-id';

export const appendMessageToThread = ({
  thread,
  body,
  author,
}: {
  thread: CommentThread;
  body: string;
  author: { id?: string; name?: string } | null;
}): CommentThread => {
  const timestamp = new Date().toISOString();
  const newMessage: CommentMessage = {
    id: createAnnotationId('comment'),
    body,
    createdAt: timestamp,
    authorId: author?.id,
    authorName: author?.name,
  };

  return {
    ...thread,
    updatedAt: timestamp,
    messages: [...(thread.messages ?? []), newMessage],
  };
};
