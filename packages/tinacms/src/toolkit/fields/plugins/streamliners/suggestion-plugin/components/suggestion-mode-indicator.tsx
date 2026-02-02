'use client';

import * as React from 'react';
import { cn } from '@udecode/cn';
import { PencilLine, X } from 'lucide-react';
import { useEditorPlugin, usePluginOption } from '@udecode/plate/react';

import { suggestionPlugin } from '../suggestion-plugin';

export const SuggestionModeIndicator = (): React.ReactElement | null => {
  const { setOption } = useEditorPlugin(suggestionPlugin);
  const isSuggesting = usePluginOption(suggestionPlugin, 'isSuggesting');

  const handleExit = React.useCallback(() => {
    setOption('isSuggesting', false);
  }, [setOption]);

  if (!isSuggesting) {
    return null;
  }

  return (
    <div
      className={cn(
        'fixed bottom-4 left-4 z-50',
        'flex items-center gap-2 px-3 py-2',
        'bg-tina-orange-dark border border-brand/30 rounded-md shadow-lg',
        'text-white',
        'backdrop-blur-sm',
        'animate-in fade-in slide-in-from-top-2 duration-300'
      )}
      role="status"
      aria-live="polite"
    >
      <PencilLine className="size-4 text-brand" />
      <span className="text-sm font-medium text-brand">
        Suggestion Mode Active
      </span>
      <button
        type="button"
        onClick={handleExit}
        className={cn(
          'ml-1 p-1 rounded hover:bg-brand/20',
          'transition-colors duration-150',
          'text-white',
          'focus:outline-none focus:ring-2 focus:ring-brand/50'
        )}
        aria-label="Exit suggestion mode"
        title="Exit suggestion mode (or click the suggestion button again)"
      >
        Exit
      </button>
    </div>
  );
};
