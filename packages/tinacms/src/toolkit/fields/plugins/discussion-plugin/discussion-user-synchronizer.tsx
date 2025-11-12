'use client';

import React from 'react';

import { useCMS } from '@toolkit/react-core';
import { useEditorPlugin, usePluginOption } from '@udecode/plate/react';

import { useAnnotationsStore } from './annotations-store';
import { discussionPlugin } from './discussion-plugin';
import type { DiscussionUser } from './types';

const createAnonymousUser = (): DiscussionUser => ({
  id: 'anonymous',
  name: 'Anonymous',
});

const normalizeAuthUser = (user: any): DiscussionUser => {
  if (!user) return createAnonymousUser();

  const id =
    user.id ??
    user.email ??
    user.sub ??
    user.userId ??
    user.uid ??
    'anonymous';
  const name = user.name ?? user.fullName ?? user.email ?? 'Anonymous';
  const avatarUrl =
    user.avatar ??
    user.avatar_url ??
    user.image ??
    user.picture ??
    undefined;

  return {
    id,
    name,
    avatarUrl,
  };
};

const areUsersEqual = (
  a: Record<string, DiscussionUser>,
  b: Record<string, DiscussionUser>
) => {
  const aKeys = Object.keys(a ?? {});
  const bKeys = Object.keys(b ?? {});
  if (aKeys.length !== bKeys.length) return false;
  for (const key of aKeys) {
    const aUser = a[key];
    const bUser = b[key];
    if (!bUser) return false;
    if (
      aUser.id !== bUser.id ||
      aUser.name !== bUser.name ||
      aUser.avatarUrl !== bUser.avatarUrl
    ) {
      return false;
    }
  }
  return true;
};

export function DiscussionUserSynchronizer() {
  const cms = useCMS();
  const authProvider = cms?.api?.tina?.authProvider;
  const { annotations } = useAnnotationsStore();
  const pluginUsers =
    (usePluginOption(discussionPlugin, 'users') as Record<
      string,
      DiscussionUser
    >) ?? {};
  const pluginCurrentUserId =
    (usePluginOption(discussionPlugin, 'currentUserId') as string) ??
    'anonymous';
  const { setOption } = useEditorPlugin(discussionPlugin);
  const [authUser, setAuthUser] = React.useState<DiscussionUser>(
    createAnonymousUser()
  );

  React.useEffect(() => {
    let cancelled = false;

    if (!authProvider?.getUser) {
      setAuthUser(createAnonymousUser());
      return () => {
        cancelled = true;
      };
    }

    void authProvider
      .getUser()
      .then((user) => {
        if (cancelled) return;
        setAuthUser(normalizeAuthUser(user));
      })
      .catch(() => {
        if (!cancelled) setAuthUser(createAnonymousUser());
      });

    return () => {
      cancelled = true;
    };
  }, [authProvider]);

  const derivedUsers = React.useMemo(() => {
    const map: Record<string, DiscussionUser> = {};

    Object.values(annotations.comments).forEach((thread) => {
      thread.messages?.forEach((message) => {
        const id = message.authorId ?? message.authorName;
        if (!id || map[id]) return;
        map[id] = {
          id,
          name: message.authorName ?? message.authorId ?? 'Anonymous',
        };
      });
    });

    return map;
  }, [annotations.comments]);

  const desiredUsers = React.useMemo(() => {
    const merged: Record<string, DiscussionUser> = {
      ...pluginUsers,
    };

    Object.entries(derivedUsers).forEach(([id, user]) => {
      merged[id] = {
        ...merged[id],
        ...user,
      };
    });

    if (authUser?.id) {
      merged[authUser.id] = authUser;
    }

    if (!merged.anonymous) {
      merged.anonymous = createAnonymousUser();
    }

    return merged;
  }, [authUser, derivedUsers, pluginUsers]);

  React.useEffect(() => {
    if (!areUsersEqual(pluginUsers, desiredUsers)) {
      setOption('users', desiredUsers);
    }
  }, [desiredUsers, pluginUsers, setOption]);

  React.useEffect(() => {
    const desiredCurrentUserId = authUser?.id ?? 'anonymous';
    if (pluginCurrentUserId !== desiredCurrentUserId) {
      setOption('currentUserId', desiredCurrentUserId);
    }
  }, [authUser?.id, pluginCurrentUserId, setOption]);

  return null;
}
