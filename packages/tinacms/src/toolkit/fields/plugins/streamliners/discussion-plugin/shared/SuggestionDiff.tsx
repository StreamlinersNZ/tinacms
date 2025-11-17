'use client';

import React from 'react';

export interface SuggestionDiffProps {
  deletedText?: string;
  insertedText?: string;
  onAccept?: () => void;
  onReject?: () => void;
}

export function SuggestionDiff({
  deletedText,
  insertedText,
  onAccept,
  onReject,
}: SuggestionDiffProps) {
  return (
    <div className="mb-4 space-y-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Suggestion
      </div>
      <div className="space-y-2 text-sm text-muted-foreground">
        {deletedText && (
          <div>
            <span className="font-semibold text-red-600">Delete:</span>{' '}
            {deletedText}
          </div>
        )}
        {insertedText && (
          <div>
            <span className="font-semibold text-emerald-600">Add:</span>{' '}
            {insertedText}
          </div>
        )}
      </div>
      {(onAccept || onReject) && (
        <div className="flex gap-2">
          {onAccept && (
            <button
              type="button"
              onClick={onAccept}
              className="flex flex-1 items-center justify-center rounded-md border border-emerald-500 px-2 py-1 text-xs font-semibold text-emerald-600 transition hover:bg-emerald-50"
            >
              Accept
            </button>
          )}
          {onReject && (
            <button
              type="button"
              onClick={onReject}
              className="flex flex-1 items-center justify-center rounded-md border border-destructive px-2 py-1 text-xs font-semibold text-destructive transition hover:bg-destructive/10"
            >
              Reject
            </button>
          )}
        </div>
      )}
    </div>
  );
}
