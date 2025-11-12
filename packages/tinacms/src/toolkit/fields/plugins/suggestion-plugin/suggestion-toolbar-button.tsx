'use client';

import * as React from 'react';

import { cn } from '@udecode/cn';
import { PencilLine } from 'lucide-react';

import { useEditorPlugin, usePluginOption } from '@udecode/plate/react';

import { ToolbarButton } from '../mdx-field-plugin/plate/components/plate-ui/toolbar';
import { suggestionPlugin } from './suggestion-plugin';

export function SuggestionToolbarButton() {
  const { setOption } = useEditorPlugin(suggestionPlugin);
  const isSuggesting = usePluginOption(suggestionPlugin, 'isSuggesting');

  const handleClick = React.useCallback(() => {
    setOption('isSuggesting', !isSuggesting);
  }, [isSuggesting, setOption]);

  return (
    <ToolbarButton
      tooltip={isSuggesting ? 'Turn off suggestions' : 'Suggest edits'}
      onClick={handleClick}
      onMouseDown={(event) => event.preventDefault()}
      className={cn(isSuggesting && 'text-brand/80 hover:text-brand/80')}
      data-plate-prevent-overlay
      data-suggestion-toolbar-button="true"
    >
      <PencilLine className="size-4" />
    </ToolbarButton>
  );
}
