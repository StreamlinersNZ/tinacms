# Discussion plugin

This plugin adds **inline comments** and **suggested edits** to the Plate editor used in Tina's MDX field.

It is built around two ideas:

1. Annotation marks live on Slate nodes (`comment_<id>` and suggestion marks).
2. Thread/suggestion metadata lives in plugin options as the single source of truth.

## Quick start

Minimal integration has two pieces: register plugins, then wire `useTinaDiscussion`.

```tsx
// 1) Register plugins (order matters)
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
// 2) Wire Tina sync in your editor component
const editor = useCreateEditor({
  plugins: [...editorPlugins],
  value: initialValue,
  components,
});

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

For a full working setup, see:

- `packages/tinacms/packages/tinacms/src/toolkit/fields/plugins/mdx-field-plugin/plate/plugins/editor-plugins.tsx`
- `packages/tinacms/packages/tinacms/src/toolkit/fields/plugins/mdx-field-plugin/plate/index.tsx`

## What gets registered

In `editor-plugins.tsx`, the editor wires:

- `discussionPlugin` (block-level discussion UI)
- `commentPlugin` (comment marks + active thread state)
- `suggestionPlugin` (suggestion marks + suggestion mode)
- `AnnotationPopover` as `commentPlugin.render.afterEditable`

The editor also uses `useTinaDiscussion(...)` to load and persist annotation state.

## Core data model

### Comment state (`commentPlugin`)

`commentPlugin` stores:

- `threads: Record<string, CommentThread>`
- `activeId`, `hoverId`
- `overlappingIds` (multiple comments on same text)
- `uniquePathMap: Map<annotationId, blockPath>`

A `CommentThread` contains message history, subject, timestamps, and resolution flags.

### Suggestion state (`suggestionPlugin`)

`suggestionPlugin` stores:

- `metadata: Record<string, StoredSuggestion>`
- `activeId`, `hoverId`
- `isSuggesting` mode
- `uniquePathMap`
- current user metadata (`currentUserId`, `currentUserName`)

## Interaction flow

### 1) Creating a comment

`CommentToolbarButton`:

- Reads the current text selection.
- Creates a new thread id.
- Applies comment marks to selected text (`comment: true` + `comment_<id>: true`).
- Creates an empty thread in `commentPlugin.options.threads`.
- Sets `activeId` so the popover opens immediately.

### 2) Creating a suggestion

`SuggestionToolbarButton` toggles `isSuggesting`.

While suggesting is enabled, the suggestion plugin adds suggestion marks/data to edited content. Suggestion metadata is tracked in `suggestionPlugin.options.metadata`.

### 3) Showing block-level discussion controls

`discussionPlugin` renders `BlockDiscussion` above each node (`render.aboveNodes`).

`BlockDiscussion`:

- scans the current block for comment nodes + suggestion nodes,
- resolves which annotations belong to that block,
- renders a small count button,
- opens a popover with `BlockThreadView` items.

`useResolvedDiscussions` and `useResolvedSuggestions` prevent duplicate rendering via `uniquePathMap`: the **deepest block path** claims ownership of each annotation id.

### 4) Active annotation popover

`AnnotationPopover` is the inline popover anchored to the active comment/suggestion leaf.

It supports:

- replying, editing, deleting messages,
- handling overlapping comment threads,
- accepting/rejecting suggestions,
- deleting empty threads on close.

Suggestion accept/reject uses helpers from `suggestion-helpers.ts` and then clears linked comment marks for that suggestion id.

## Tina form sync lifecycle

`useTinaDiscussion` handles editor <-> form synchronization:

1. Registers `annotations.entries` with Final Form (`final-form-bridge.ts`) so annotation-only changes mark the form dirty.
2. Reads initial annotations from Tina form values.
3. Calls `loadAnnotations(...)` once on mount:
   - loads `threads` into `commentPlugin`
   - loads suggestion `metadata` into `suggestionPlugin`
   - builds initial `uniquePathMap` by scanning editor nodes.
4. On annotation changes (`AnnotationSync`), writes back to `annotations.entries` through `tina-integration.ts`.

This keeps rich-text content and annotation metadata synchronized without forcing unnecessary editor updates.

## Key files

- `plugins/comment-plugin.tsx` - comment plugin state + click behavior
- `plugins/discussion-plugin.tsx` - block discussion plugin (`aboveNodes` renderer)
- `components/comment-toolbar-button.tsx` - starts comment threads
- `components/block-discussion.tsx` - per-block button + thread list popover
- `components/annotation-popover.tsx` - active annotation popover UI
- `hooks/discussion-hooks.ts` - resolves block-owned discussions/suggestions
- `hooks/use-tina-discussion.tsx` - Tina integration and sync orchestration
- `utils/tina-integration.ts` - load/read/serialize annotation state
- `utils/comment-marks.ts` - add/clear comment marks tied to suggestions

## Notes
- `threads` and `metadata` are treated as the authoritative annotation state at runtime.
