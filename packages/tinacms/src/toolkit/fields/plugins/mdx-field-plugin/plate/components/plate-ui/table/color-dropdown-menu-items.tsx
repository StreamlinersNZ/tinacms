'use client';

import React from 'react';

import { cn } from '@udecode/cn';

import { DropdownMenuItem } from '../dropdown-menu';

type TableCellBackgroundColor = {
  name: string;
  value: string;
};

const DEFAULT_COLORS: TableCellBackgroundColor[] = [
  { name: 'Light gray', value: '#f3f4f6' },
  { name: 'Light red', value: '#fee2e2' },
  { name: 'Light orange', value: '#ffedd5' },
  { name: 'Light yellow', value: '#fef9c3' },
  { name: 'Light green', value: '#dcfce7' },
  { name: 'Light blue', value: '#dbeafe' },
  { name: 'Light purple', value: '#f3e8ff' },
];

type ColorDropdownMenuItemsProps = {
  className?: string;
  colors: TableCellBackgroundColor[];
  updateColor: (color: string) => void;
};

const ColorDropdownMenuItems = ({
  className,
  colors,
  updateColor,
}: ColorDropdownMenuItemsProps): React.JSX.Element => {
  return (
    <>
      {colors.map((item) => {
        return (
          <DropdownMenuItem
            key={item.value}
            className={cn('gap-2', className)}
            onClick={() => {
              updateColor(item.value);
            }}
          >
            <span
              aria-hidden
              className='size-4 shrink-0 rounded border border-gray-300'
              style={{ backgroundColor: item.value }}
            />
            <span>{item.name}</span>
          </DropdownMenuItem>
        );
      })}
    </>
  );
};

export { ColorDropdownMenuItems, DEFAULT_COLORS };
export type { TableCellBackgroundColor, ColorDropdownMenuItemsProps };
