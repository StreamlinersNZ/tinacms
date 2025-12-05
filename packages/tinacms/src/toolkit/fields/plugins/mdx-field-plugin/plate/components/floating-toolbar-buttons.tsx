import React from 'react';
import { TurnIntoDropdownMenu } from './plate-ui/turn-into-dropdown-menu';
import { CommentToolbarButton } from '../../../streamliners/discussion-plugin/components/comment-toolbar-button';
import { SuggestionToolbarButton } from '../../../streamliners/suggestion-plugin/components/suggestion-toolbar-button';
import { useAnnotationUser } from '../../../streamliners/discussion-plugin/hooks/use-annotation-state';

export default function FloatingToolbarButtons() {
  const currentUser = useAnnotationUser();
  const isLoading = !currentUser;

  return (
    <div className="flex items-center gap-1 rounded-md">
      <TurnIntoDropdownMenu />
      <CommentToolbarButton />
      <SuggestionToolbarButton />
      {isLoading && (
        <span className="ml-2 text-xs text-muted-foreground animate-pulse">
          Loading profile...
        </span>
      )}
    </div>
  );
}
