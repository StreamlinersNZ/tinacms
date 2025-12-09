'use client';

import * as React from 'react';

import { cn } from '@udecode/cn';
import { PencilLine, Loader2 } from 'lucide-react';

import { useEditorPlugin, usePluginOption } from '@udecode/plate/react';

import { ToolbarButton } from '../../../mdx-field-plugin/plate/components/plate-ui/toolbar';
import { suggestionPlugin } from '../suggestion-plugin';
import { useAnnotationUser } from '../../discussion-plugin/hooks/use-annotation-state';

export function SuggestionToolbarButton() {
  const { setOption } = useEditorPlugin(suggestionPlugin);
  const isSuggesting = usePluginOption(suggestionPlugin, 'isSuggesting');
  const currentUser = useAnnotationUser();

  const handleClick = React.useCallback(() => {
    if (!currentUser?.id) return;
    setOption('isSuggesting', !isSuggesting);
  }, [currentUser?.id, isSuggesting, setOption]);

  React.useEffect(() => {
    if (currentUser?.id) {
      setOption('currentUserId', currentUser.id);
      setOption('currentUserName', currentUser.name ?? null);
    }
  }, [currentUser?.id, currentUser?.name, setOption]);

  const isLoading = !currentUser?.id;

  return (
    <ToolbarButton
      disabled={isLoading}
      tooltip={
        isLoading
          ? 'Loading user...'
          : isSuggesting
            ? 'Turn off suggestions'
            : 'Suggest edits'
      }
      onClick={handleClick}
      onMouseDown={(event) => event.preventDefault()}
      className={cn(isSuggesting && 'text-brand/80 hover:text-brand/80')}
      data-plate-prevent-overlay
      data-suggestion-toolbar-button="true"
    >
      {isLoading ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <PencilLine className="size-4" />
      )}
    </ToolbarButton>
  );
}
