'use client';

import React from 'react';

import { cn } from '@utils/cn';
import type { TTableElement } from '@udecode/plate-table';
import { TablePlugin } from '@udecode/plate-table/react';
import { useEditorPlugin, useEditorSelector } from '@udecode/plate/react';

export type TableVariant =
  | 'table--basic'
  | 'table--full-width'
  | 'table--responsive';

const TABLE_VARIANTS: { value: TableVariant; label: string }[] = [
  { value: 'table--basic', label: 'Basic' },
  { value: 'table--full-width', label: 'Full width' },
  { value: 'table--responsive', label: 'Responsive' },
];

interface TableVariantSelectorProps {
  selectedVariant: TableVariant;
  onVariantChange: (variant: TableVariant) => void;
}

export function TableVariantSelector({
  selectedVariant,
  onVariantChange,
}: TableVariantSelectorProps) {
  const { editor } = useEditorPlugin(TablePlugin);
  const tableSelected = useEditorSelector(
    (editor) => editor.api.some({ match: { type: TablePlugin.key } }),
    []
  );

  return (
    <div className='flex gap-0.5 border-b border-gray-200 p-1'>
      {TABLE_VARIANTS.map(({ value, label }) => (
        <button
          key={value}
          type='button'
          className={cn(
            'flex-1 cursor-pointer rounded-sm px-2 py-1 text-xs',
            selectedVariant === value
              ? 'bg-primary text-primary-foreground font-medium'
              : 'text-foreground hover:bg-muted'
          )}
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => {
            e.stopPropagation();
            onVariantChange(value);
            if (tableSelected) {
              editor.tf.setNodes<TTableElement & { className: string }>(
                { className: value },
                {
                  match: (n) => n.type === TablePlugin.key,
                  mode: 'highest',
                }
              );
              editor.tf.focus();
            }
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
