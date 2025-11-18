'use client';

import {
  type ExtendConfig,
  type Path,
  isSlateEditor,
  isSlateElement,
  isSlateString,
} from '@udecode/plate';
import {
  type BaseSuggestionConfig,
  BaseSuggestionPlugin,
} from '@udecode/plate-suggestion';
import { toTPlatePlugin } from '@udecode/plate/react';
import type { SlatePlugin } from '@udecode/plate';
import type { TSuggestionText } from '@udecode/plate-suggestion';

import { SuggestionLeaf } from './components/suggestion-leaf';
import type { StoredSuggestion } from '../discussion-plugin/utils/annotations-store';

export type SuggestionDiff = {
  insertedText?: string;
  deletedText?: string;
  type: 'insert' | 'remove' | 'replace' | 'update';
};

export type SuggestionPluginConfig = ExtendConfig<
  BaseSuggestionConfig,
  {
    activeId: string | null;
    hoverId: string | null;
    uniquePathMap: Map<string, Path>;
    isSuggesting: boolean;
    metadata: Record<string, StoredSuggestion>; // Single source of truth for suggestion metadata
  }
>;

const baseSuggestionPlugin = BaseSuggestionPlugin as unknown as SlatePlugin<SuggestionPluginConfig>;

export const suggestionPlugin = toTPlatePlugin<SuggestionPluginConfig>(
  baseSuggestionPlugin,
  () => ({
    handlers: {
      onClick: ({ api, event, setOption, type }) => {
        let leaf = event.target as HTMLElement;
        let isSet = false;

        const unsetActiveSuggestion = () => {
          setOption('activeId', null);
          isSet = true;
        };

        if (!isSlateString(leaf)) unsetActiveSuggestion();

        while (
          leaf.parentElement &&
          !isSlateElement(leaf.parentElement) &&
          !isSlateEditor(leaf.parentElement)
        ) {
          if (leaf.classList.contains(`slate-${type}`)) {
            const suggestionEntry = api.suggestion!.node({ isText: true });

            if (!suggestionEntry) {
              unsetActiveSuggestion();

              break;
            }
            const [node] = suggestionEntry as [TSuggestionText, Path];
            const id = api.suggestion!.nodeId(node);
            setOption('activeId', id ?? null);
            isSet = true;

            break;
          }

          leaf = leaf.parentElement;
        }
        if (!isSet) unsetActiveSuggestion();
      },
    },
    options: {
      activeId: null,
      hoverId: null,
      uniquePathMap: new Map(),
      isSuggesting: false,
      currentUserId: 'anonymous',
      metadata: {}, // Single source of truth - loaded from TinaCMS
    },
    render: {
      leaf: SuggestionLeaf,
    },
  })
);

export default suggestionPlugin;
