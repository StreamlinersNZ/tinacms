import React from 'react';
import { usePluginOption } from '@udecode/plate/react';
import { commentPlugin } from '../plugins/comment-plugin';
import { suggestionPlugin } from '../../suggestion-plugin/suggestion-plugin';

export const AnnotationSync = ({ onSync }: { onSync: () => void }) => {
  const threads = usePluginOption(commentPlugin, 'threads');
  const suggestions = usePluginOption(suggestionPlugin, 'metadata');

  // Compare by stable signatures so we only emit when content actually changes
  const threadsSig = React.useMemo(
    () => JSON.stringify(threads ?? {}),
    [threads]
  );
  const suggestionsSig = React.useMemo(
    () => JSON.stringify(suggestions ?? {}),
    [suggestions]
  );

  React.useEffect(() => {
    onSync();
  }, [threadsSig, suggestionsSig, onSync]);

  return null;
};
