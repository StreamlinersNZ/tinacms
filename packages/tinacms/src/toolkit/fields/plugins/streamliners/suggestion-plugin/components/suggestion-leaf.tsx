'use client';

import React from 'react';

import type { TSuggestionText } from '@udecode/plate-suggestion';

import { cn } from '@udecode/cn';
import { type PlateLeafProps, PlateLeaf, useEditorPlugin, usePluginOption } from '@udecode/plate/react';

import { suggestionPlugin } from '../suggestion-plugin';

export function SuggestionLeaf(props: PlateLeafProps) {
  const { children, className, leaf } = props;

  const { api, setOption } = useEditorPlugin(suggestionPlugin);

  const dataList = api.suggestion.dataList(leaf as TSuggestionText);
  const leafId: string = api.suggestion.nodeId(leaf as TSuggestionText) ?? '';
  const activeSuggestionId = usePluginOption(suggestionPlugin, 'activeId');
  const hoverSuggestionId = usePluginOption(suggestionPlugin, 'hoverId');

  const hasRemove = dataList.some((data) => data.type === 'remove');
  const hasActive = dataList.some((data) => data.id === activeSuggestionId);
  const hasHover = dataList.some((data) => data.id === hoverSuggestionId);

  const Component = hasRemove ? 'del' : 'ins';

  return (
    <PlateLeaf
      {...props}
      as={Component as keyof HTMLElementTagNameMap}
      className={cn(
        className,
        'bg-emerald-100 text-emerald-800 no-underline transition-colors duration-150',
        (hasActive || hasHover) && 'bg-emerald-200 text-emerald-900',
        hasRemove && 'bg-red-100 text-red-700',
        (hasActive || hasHover) && hasRemove && 'bg-red-200 text-red-800'
      )}
      attributes={{
        ...props.attributes,
        'data-suggestion-leaf': 'true',
        'data-suggestion-id': leafId,
        onMouseEnter: () => setOption('hoverId', leafId),
        onMouseLeave: () => setOption('hoverId', null),
      }}
    >
      {children}
    </PlateLeaf>
  );
}
