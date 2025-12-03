import * as React from 'react';

import { useCMS } from '@toolkit/react-core';
import { useEditorPlugin } from '@udecode/plate/react';

import { commentPlugin, type CommentThread } from '../plugins/comment-plugin';

export type CurrentUser = { id?: string; name?: string } | null;

// Global cache to store the user promise/result
let userPromise: Promise<CurrentUser> | null = null;
let cachedUser: CurrentUser = null;

type ThreadsUpdater =
  | Record<string, CommentThread>
  | ((previous: Record<string, CommentThread>) => Record<string, CommentThread>);

export const useAnnotationUser = () => {
  const cms = useCMS();
  const [currentUser, setCurrentUser] = React.useState<CurrentUser>(cachedUser);

  React.useEffect(() => {
    if (cachedUser) {
      if (currentUser !== cachedUser) {
        setCurrentUser(cachedUser);
      }
      return;
    }

    let mounted = true;

    if (!userPromise) {
      userPromise = cms.api.tina.authProvider
        .getUser()
        .then((user) => {
          if (!user) {
            return null;
          }

          const id = user.id ?? user.email;
          if (!id) {
            return null;
          }

          const name = user.name ?? user.email ?? 'Unknown';
          const userData = { id, name };
          cachedUser = userData;
          return userData;
        })
        .catch((error) => {
          console.error('[useAnnotationUser] Error loading user:', error);
          userPromise = null;
          return null;
        });
    }

    userPromise.then((user) => {
      if (mounted) {
        setCurrentUser(user);
      }
    });

    return () => {
      mounted = false;
    };
  }, [cms.api.tina.authProvider, currentUser]);

  return currentUser;
};

export const useAnnotationThreads = () => {
  const { editor } = useEditorPlugin(commentPlugin);

  const getThreads = React.useCallback(
    () =>
      (editor.getOption(commentPlugin, 'threads') || {}) as Record<
        string,
        CommentThread
      >,
    [editor]
  );

  const setThreads = React.useCallback(
    (updater: ThreadsUpdater) => {
      const previous = getThreads();
      const next =
        typeof updater === 'function' ? updater(previous) : { ...updater };

      if (previous === next) return;
      editor.setOption(commentPlugin, 'threads', next);
    },
    [editor, getThreads]
  );

  const commitThread = React.useCallback(
    (thread: CommentThread) => {
      setThreads((prev) => ({
        ...prev,
        [thread.id]: thread,
      }));
    },
    [setThreads]
  );

  const deleteThread = React.useCallback(
    (threadId: string) => {
      setThreads((prev) => {
        if (!prev[threadId]) return prev;
        const next = { ...prev };
        delete next[threadId];
        editor.getTransforms(commentPlugin).comment.unsetMark?.({ id: threadId });
        return next;
      });
    },
    [editor, setThreads]
  );

  const removeEmptyThreads = React.useCallback(
    (ids?: string[] | null) => {
      if (!ids?.length) return;
      setThreads((prev) => {
        let next: Record<string, CommentThread> | null = null;

        ids.forEach((id) => {
          const thread = prev[id];
          if (!thread) return;
          if ((thread.messages?.length ?? 0) > 0) return;

          editor.getTransforms(commentPlugin).comment.unsetMark?.({ id });
          if (!next) {
            next = { ...prev };
          }
          delete next[id];
        });

        return next ?? prev;
      });
    },
    [editor, setThreads]
  );

  return {
    getThreads,
    commitThread,
    deleteThread,
    removeEmptyThreads,
  };
};
