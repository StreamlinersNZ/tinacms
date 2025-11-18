import { ElementApi, TextApi, type Path } from '@udecode/plate';
import type { PlateEditor } from '@udecode/plate/react';
import {
  acceptSuggestion,
  rejectSuggestion,
  TSuggestionText,
} from '@udecode/plate-suggestion';

import { suggestionPlugin } from '../suggestion-plugin';
import type { SuggestionDiff } from '../suggestion-plugin';

export const getSuggestionDiff = (
  editor: PlateEditor,
  suggestionId: string
): SuggestionDiff | null => {
  if (!suggestionId) return null;

  const suggestionApi = editor.getApi(suggestionPlugin).suggestion;
  const entries = Array.from(
    suggestionApi.nodes({ at: [], mode: 'all' }) as Iterable<[any, Path]>
  );

  let inserted = '';
  let deleted = '';

  for (const [node] of entries) {
    if (TextApi.isText(node)) {
      const dataList = suggestionApi.dataList(node as TSuggestionText);
      dataList.forEach((data) => {
        if (data.id !== suggestionId) return;
        const text = node.text ?? '';
        if (data.type === 'insert') {
          inserted += text;
        } else if (data.type === 'remove') {
          deleted += text;
        } else if (data.type === 'update') {
          inserted += text;
        }
      });
    } else if (ElementApi.isElement(node)) {
      const suggestionData = suggestionApi.isBlockSuggestion(node)
        ? node.suggestion
        : undefined;
      if (!suggestionData) continue;
      if (suggestionData.id !== suggestionId) continue;
      const label = `[${node.type}]`;
      if (suggestionData.type === 'insert') {
        inserted += label;
      } else {
        deleted += label;
      }
    }
  }

  const normalize = (value: string) => value.replace(/\s+/g, ' ').trim();
  inserted = normalize(inserted);
  deleted = normalize(deleted);

  if (!inserted && !deleted) return null;

  const type: SuggestionDiff['type'] =
    inserted && deleted ? 'replace' : inserted ? 'insert' : 'remove';

  return {
    insertedText: inserted || undefined,
    deletedText: deleted || undefined,
    type,
  };
};

export const buildResolvedSuggestion = ({
  suggestionId,
  diff,
  userId,
}: {
  suggestionId: string;
  diff: SuggestionDiff;
  userId?: string;
}) => ({
  createdAt: new Date(),
  keyId: suggestionId,
  suggestionId,
  type: diff.type,
  userId: userId ?? 'anonymous',
  ...(diff.deletedText ? { text: diff.deletedText } : {}),
  ...(diff.insertedText ? { newText: diff.insertedText } : {}),
});

export const acceptActiveSuggestion = ({
  editor,
  suggestionId,
  diff,
  userId,
}: {
  editor: PlateEditor;
  suggestionId: string;
  diff: SuggestionDiff;
  userId?: string;
}) => {
  const suggestionApi = editor.getApi(suggestionPlugin).suggestion;
  suggestionApi.withoutSuggestions(() => {
    acceptSuggestion(
      editor,
      buildResolvedSuggestion({ suggestionId, diff, userId })
    );
  });
};

export const rejectActiveSuggestion = ({
  editor,
  suggestionId,
  diff,
  userId,
}: {
  editor: PlateEditor;
  suggestionId: string;
  diff: SuggestionDiff;
  userId?: string;
}) => {
  const suggestionApi = editor.getApi(suggestionPlugin).suggestion;
  suggestionApi.withoutSuggestions(() => {
    rejectSuggestion(
      editor,
      buildResolvedSuggestion({ suggestionId, diff, userId })
    );
  });
};
