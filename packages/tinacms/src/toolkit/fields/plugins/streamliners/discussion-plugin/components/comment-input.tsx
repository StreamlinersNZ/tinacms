'use client';

import React from 'react';

export interface CommentInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onCancel?: () => void;
  placeholder?: string;
  submitLabel?: string;
  cancelLabel?: string;
  autoFocus?: boolean;
  minHeight?: string;
}

export function CommentInput({
  value,
  onChange,
  onSubmit,
  onCancel,
  placeholder = 'Add a comment…',
  submitLabel = 'Comment',
  cancelLabel = 'Cancel',
  autoFocus = false,
  minHeight = '60px',
}: CommentInputProps) {
  const disabled = !value.trim();

  return (
    <div className="flex flex-col gap-2">
      <textarea
        className="w-full resize-y rounded-md border bg-background p-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        style={{ minHeight }}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoFocus={autoFocus}
      />
      <div className="flex justify-end gap-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-input bg-transparent px-3 py-1.5 text-sm text-muted-foreground shadow-sm transition-colors hover:bg-accent"
          >
            {cancelLabel}
          </button>
        )}
        <button
          type="button"
          onClick={onSubmit}
          disabled={disabled}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white shadow-sm transition-colors hover:bg-blue-600/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitLabel}
        </button>
      </div>
    </div>
  );
}
