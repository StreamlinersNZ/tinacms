'use client';

import React from 'react';

import { useEditorPlugin, usePluginOption } from '@udecode/plate/react';

import {
  commentThreadsToDiscussions,
  discussionsToCommentThreads,
  areDiscussionsEqual,
} from './discussion-adapter';
import { discussionPlugin } from './discussion-plugin';
import { useAnnotationsStore } from './annotations-store';
import { areCommentMapsEqual } from './comment-annotations';
import type { TDiscussion } from './types';

const isDev = process.env.NODE_ENV !== 'production';

export function DiscussionPluginBridge() {
  const { annotations, setComments } = useAnnotationsStore();
  const { setOption } = useEditorPlugin(discussionPlugin);
  const pluginDiscussions =
    (usePluginOption(discussionPlugin, 'discussions') as TDiscussion[]) ?? [];

  const targetDiscussions = React.useMemo(
    () => commentThreadsToDiscussions(annotations.comments),
    [annotations.comments]
  );

  const threadsFromPlugin = React.useMemo(
    () => discussionsToCommentThreads(pluginDiscussions ?? []),
    [pluginDiscussions]
  );

  const previousPluginRef = React.useRef<TDiscussion[] | null>(null);
  const previousCommentsRef = React.useRef<
    ReturnType<typeof discussionsToCommentThreads> | null
  >(null);

  const logSync = React.useCallback(
    (
      direction: 'annotations->plugin' | 'plugin->annotations',
      meta: Record<string, unknown>
    ) => {
      if (!isDev) return;
      console.debug('[DiscussionPluginBridge] sync', direction, meta);
    },
    []
  );

  React.useEffect(() => {
    const pluginChanged =
      !previousPluginRef.current ||
      !areDiscussionsEqual(previousPluginRef.current, pluginDiscussions);
    const commentsChanged =
      !previousCommentsRef.current ||
      !areCommentMapsEqual(previousCommentsRef.current, annotations.comments);

    previousPluginRef.current = pluginDiscussions;
    previousCommentsRef.current = annotations.comments;

    const pluginNeedsUpdate = !areDiscussionsEqual(
      pluginDiscussions,
      targetDiscussions
    );
    const commentsNeedUpdate = !areCommentMapsEqual(
      annotations.comments,
      threadsFromPlugin
    );

    let direction: 'annotations->plugin' | 'plugin->annotations' | null = null;

    if (pluginChanged && !commentsChanged && commentsNeedUpdate) {
      direction = 'plugin->annotations';
    } else if (commentsChanged && !pluginChanged && pluginNeedsUpdate) {
      direction = 'annotations->plugin';
    } else if (pluginChanged && commentsChanged) {
      direction = pluginNeedsUpdate ? 'annotations->plugin' : direction;
      if (!direction && commentsNeedUpdate) {
        direction = 'plugin->annotations';
      }
    } else {
      if (pluginNeedsUpdate) {
        direction = 'annotations->plugin';
      } else if (commentsNeedUpdate) {
        direction = 'plugin->annotations';
      }
    }

    if (direction === 'annotations->plugin') {
      setOption('discussions', targetDiscussions);
      logSync(direction, {
        pluginChanged,
        commentsChanged,
        pluginNeedsUpdate,
        commentsNeedUpdate,
        targetSize: targetDiscussions.length,
      });
      return;
    }

    if (direction === 'plugin->annotations') {
      setComments(threadsFromPlugin);
      logSync(direction, {
        pluginChanged,
        commentsChanged,
        pluginNeedsUpdate,
        commentsNeedUpdate,
        discussionCount: pluginDiscussions.length,
      });
    }
  }, [
    annotations.comments,
    logSync,
    pluginDiscussions,
    setComments,
    setOption,
    targetDiscussions,
    threadsFromPlugin,
  ]);

  return null;
}
