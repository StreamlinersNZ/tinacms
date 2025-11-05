import React from 'react';
import { TurnIntoDropdownMenu } from './plate-ui/turn-into-dropdown-menu';
import { CommentToolbarButton } from '../../../discussion-plugin/comment-toolbar-button';
import { SuggestionToolbarButton } from '../../../suggestion-plugin/suggestion-toolbar-button';

export default function FloatingToolbarButtons() {
  return (
    <div className='flex items-center gap-1 rounded-md'>
      <TurnIntoDropdownMenu />
      <CommentToolbarButton />
      <SuggestionToolbarButton />
    </div>
  );
}
