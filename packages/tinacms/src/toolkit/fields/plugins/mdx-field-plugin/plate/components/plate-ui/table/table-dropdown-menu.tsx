'use client';

import React, { useState } from 'react';

import type { DropdownMenuProps } from '@radix-ui/react-dropdown-menu';

import { cn } from '@utils/cn';
import type { TTableElement } from '@udecode/plate-table';
import { TablePlugin, useTableMergeState } from '@udecode/plate-table/react';
import { useEditorPlugin, useEditorSelector } from '@udecode/plate/react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Combine,
  Grid3x3Icon,
  Table,
  Trash2Icon,
  Ungroup,
  XIcon,
} from 'lucide-react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  useOpenState,
} from '../dropdown-menu';
import { ToolbarButton } from '../toolbar';

type TableVariant = 'table--basic' | 'table--full-width' | 'table--responsive';

const TABLE_VARIANTS: { value: TableVariant; label: string }[] = [
  { value: 'table--basic', label: 'Basic' },
  { value: 'table--full-width', label: 'Full width' },
  { value: 'table--responsive', label: 'Responsive' },
];

export function TableDropdownMenu(props: DropdownMenuProps) {
  const tableSelected = useEditorSelector(
    (editor) => editor.api.some({ match: { type: TablePlugin.key } }),
    []
  );

  const { editor, tf } = useEditorPlugin(TablePlugin);
  const openState = useOpenState();
  const mergeState = useTableMergeState();

  return (
    <DropdownMenu modal={false} {...openState} {...props}>
      <DropdownMenuTrigger asChild>
        <ToolbarButton pressed={openState.open} tooltip='Table' isDropdown>
          <Table />
        </ToolbarButton>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        className='flex w-[180px] min-w-0 flex-col'
        align='start'
      >
        <DropdownMenuGroup>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Grid3x3Icon />
              <span>Table</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className='m-0 p-0'>
              <TablePicker />
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuSub>
            <DropdownMenuSubTrigger disabled={!tableSelected}>
              <div className='size-4' />
              <span>Cell</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem
                className='min-w-[180px]'
                disabled={!mergeState.canMerge}
                onSelect={() => {
                  tf.table.merge();
                  editor.tf.focus();
                }}
              >
                <Combine />
                Merge cells
              </DropdownMenuItem>
              <DropdownMenuItem
                className='min-w-[180px]'
                disabled={!mergeState.canSplit}
                onSelect={() => {
                  tf.table.split();
                  editor.tf.focus();
                }}
              >
                <Ungroup />
                Split cell
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuSub>
            <DropdownMenuSubTrigger disabled={!tableSelected}>
              <div className='size-4' />
              <span>Row</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem
                className='min-w-[180px]'
                disabled={!tableSelected}
                onSelect={() => {
                  tf.insert.tableRow({ before: true });
                  editor.tf.focus();
                }}
              >
                <ArrowUp />
                Insert row before
              </DropdownMenuItem>
              <DropdownMenuItem
                className='min-w-[180px]'
                disabled={!tableSelected}
                onSelect={() => {
                  tf.insert.tableRow();
                  editor.tf.focus();
                }}
              >
                <ArrowDown />
                Insert row after
              </DropdownMenuItem>
              <DropdownMenuItem
                className='min-w-[180px]'
                disabled={!tableSelected}
                onSelect={() => {
                  tf.remove.tableRow();
                  editor.tf.focus();
                }}
              >
                <XIcon />
                Delete row
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuSub>
            <DropdownMenuSubTrigger disabled={!tableSelected}>
              <div className='size-4' />
              <span>Column</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem
                className='min-w-[180px]'
                disabled={!tableSelected}
                onSelect={() => {
                  tf.insert.tableColumn({ before: true });
                  editor.tf.focus();
                }}
              >
                <ArrowLeft />
                Insert column before
              </DropdownMenuItem>
              <DropdownMenuItem
                className='min-w-[180px]'
                disabled={!tableSelected}
                onSelect={() => {
                  tf.insert.tableColumn();
                  editor.tf.focus();
                }}
              >
                <ArrowRight />
                Insert column after
              </DropdownMenuItem>
              <DropdownMenuItem
                className='min-w-[180px]'
                disabled={!tableSelected}
                onSelect={() => {
                  tf.remove.tableColumn();
                  editor.tf.focus();
                }}
              >
                <XIcon />
                Delete column
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuItem
            className='min-w-[180px]'
            disabled={!tableSelected}
            onSelect={() => {
              tf.remove.table();
              editor.tf.focus();
            }}
          >
            <Trash2Icon />
            Delete table
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function TablePicker() {
  const { editor, tf } = useEditorPlugin(TablePlugin);
  const tableSelected = useEditorSelector(
    (editor) => editor.api.some({ match: { type: TablePlugin.key } }),
    []
  );

  const [selectedVariant, setSelectedVariant] = useState<TableVariant>('table--basic');

  const [tablePicker, setTablePicker] = useState({
    grid: Array.from({ length: 8 }, () => Array.from({ length: 8 }).fill(0)),
    size: { colCount: 0, rowCount: 0 },
  });

  const onCellMove = (rowIndex: number, colIndex: number) => {
    const newGrid = [...tablePicker.grid];

    for (let i = 0; i < newGrid.length; i++) {
      for (let j = 0; j < newGrid[i].length; j++) {
        newGrid[i][j] =
          i >= 0 && i <= rowIndex && j >= 0 && j <= colIndex ? 1 : 0;
      }
    }

    setTablePicker({
      grid: newGrid,
      size: { colCount: colIndex + 1, rowCount: rowIndex + 1 },
    });
  };

  return (
    <div className='m-0 flex! flex-col p-0'>
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
              setSelectedVariant(value);
              if (tableSelected) {
                editor.tf.setNodes<TTableElement & { className: string }>(
                  { className: value },
                  { match: (n) => n.type === TablePlugin.key, mode: 'highest' }
                );
                editor.tf.focus();
              }
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div
        className='grid size-[130px] grid-cols-8 gap-0.5 p-1'
        onClick={() => {
          tf.insert.table(tablePicker.size, { select: true });
          editor.tf.setNodes<TTableElement & { className: string }>(
            { className: selectedVariant },
            { match: (n) => n.type === TablePlugin.key, mode: 'highest' }
          );
          editor.tf.focus();
        }}
      >
        {tablePicker.grid.map((rows, rowIndex) =>
          rows.map((value, columIndex) => {
            return (
              <div
                key={`(${rowIndex},${columIndex})`}
                className={cn(
                  'col-span-1 size-3 border border-solid bg-secondary',
                  !!value && 'border-current'
                )}
                onMouseMove={() => {
                  onCellMove(rowIndex, columIndex);
                }}
              />
            );
          })
        )}
      </div>

      <div className='pb-1 text-center text-xs text-current'>
        {tablePicker.size.rowCount} x {tablePicker.size.colCount}
      </div>
    </div>
  );
}
