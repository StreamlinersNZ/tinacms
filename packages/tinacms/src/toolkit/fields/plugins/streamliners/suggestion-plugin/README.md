# Suggestion plugin

This plugin adds **track changes style suggestions** to the Plate editor used in Tina's MDX field.

It combines:

1. Suggestion marks/data on Slate nodes (from Plate suggestion primitives).
2. Runtime suggestion state in plugin options (`activeId`, `isSuggesting`, `metadata`, etc.).

## Quick start

Minimal integration has three parts: register the plugin, expose the toolbar button, and wire editor/form sync.

```tsx
// 1) Register plugins (same order used by the editor today)
const editorPlugins = [
  // ...other plugins
  discussionPlugin,
  commentPlugin.configure({
    render: { afterEditable: () => <AnnotationPopover /> },
  }),
  suggestionPlugin,
];
```

```tsx
// 2) Add the suggestion toggle button in your floating toolbar
function FloatingToolbarButtons() {
  return (
    <div className="flex items-center gap-1 rounded-md">
      <TurnIntoDropdownMenu />
      <CommentToolbarButton />
      <SuggestionToolbarButton />
    </div>
  );
}
```

```tsx
// 3) Keep suggestion metadata synced with Tina form state
const { onChange, SyncComponent } = useTinaDiscussion({
  tinaForm,
  editor,
  input,
  field,
  normalizeLinksInCodeBlocks,
});

return (
  <Plate editor={editor} onChange={onChange}>
    <SyncComponent />
    <Editor />
  </Plate>
);
```

For full working usage, see:

- `packages/tinacms/packages/tinacms/src/toolkit/fields/plugins/mdx-field-plugin/plate/plugins/editor-plugins.tsx`
- `packages/tinacms/packages/tinacms/src/toolkit/fields/plugins/mdx-field-plugin/plate/components/floating-toolbar-buttons.tsx`
- `packages/tinacms/packages/tinacms/src/toolkit/fields/plugins/streamliners/discussion-plugin/hooks/use-tina-discussion.tsx`

## Plugin state

`suggestionPlugin` extends `BaseSuggestionPlugin` and tracks:

- `activeId`, `hoverId` - currently focused/hovered suggestion
- `isSuggesting` - whether suggestion mode is enabled
- `metadata: Record<string, StoredSuggestion>` - persisted suggestion metadata
- `uniquePathMap: Map<string, Path>` - owning block path per annotation id
- `currentUserId`, `currentUserName` - set from the current Tina user

`metadata` is treated as the single source of truth for suggestion metadata at runtime.

## Interaction flow

### 1) Toggle suggestion mode

`SuggestionToolbarButton`:

- loads the current user (`useAnnotationUser`),
- stores user identity in plugin options (`currentUserId`, `currentUserName`),
- toggles `isSuggesting`.

### 2) Edit content while suggesting

When suggestion mode is on, suggestion data is added to edited nodes by the underlying suggestion plugin behavior.

### 3) Render suggestion marks inline

`SuggestionLeaf`:

- reads suggestion data from the leaf,
- renders insertions as `<ins>` and removals as `<del>`,
- applies active/hover styling,
- exposes `data-suggestion-leaf`/`data-suggestion-id` attributes used by annotation UI.

### 4) Activate and review a suggestion

- Plugin `onClick` resolves the clicked suggestion and sets `activeId`.
- Discussion UI (`AnnotationPopover` / block discussion panels) uses the active suggestion id to show diff + actions.
- Accept/reject actions call `acceptActiveSuggestion` / `rejectActiveSuggestion`, then clear linked comment thread marks.

## Tina sync + persistence

Suggestion data is persisted through discussion-plugin sync utilities:

1. On load, `loadAnnotations(...)` hydrates `suggestionPlugin.options.metadata`.
2. `AnnotationSync` watches suggestion metadata changes and triggers form sync.
3. `useTinaDiscussion` writes changes to `annotations.entries`.
4. Before emitting editor value, `annotateSuggestionsWithUserName(...)` injects `userName` into suggestion payloads.

## Key files

- `suggestion-plugin.tsx` - plugin definition, options, click handler, leaf renderer
- `components/suggestion-toolbar-button.tsx` - toggle suggestion mode + set user info
- `components/suggestion-leaf.tsx` - inline mark rendering and hover/active behavior
- `utils/suggestion-helpers.ts` - diff extraction + accept/reject helpers
- `utils/annotate-suggestions.ts` - inject userName into suggestion payloads before save
- `components/suggestion-diff.tsx` - reusable diff UI for accept/reject controls

## Notes

- Suggestion approval/rejection UI is rendered primarily from discussion plugin surfaces (`AnnotationPopover` and block thread views).
