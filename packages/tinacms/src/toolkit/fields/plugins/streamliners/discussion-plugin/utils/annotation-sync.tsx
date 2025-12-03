import React from 'react';
import { usePluginOption } from '@udecode/plate/react';
import { commentPlugin } from '../plugins/comment-plugin';
import { suggestionPlugin } from '../../suggestion-plugin/suggestion-plugin';

export const AnnotationSync = ({ onSync }: { onSync: () => void }) => {
  const threads = usePluginOption(commentPlugin, 'threads');
  const suggestions = usePluginOption(suggestionPlugin, 'metadata');

  React.useEffect(() => {
    onSync();
  }, [threads, suggestions, onSync]);

  return null;
};
