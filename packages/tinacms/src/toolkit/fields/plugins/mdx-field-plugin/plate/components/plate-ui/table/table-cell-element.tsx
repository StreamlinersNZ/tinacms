'use client';

import React from 'react';

import type { TTableCellElement } from '@udecode/plate-table';

import { cn, withProps, withRef } from '@udecode/cn';
import { useBlockSelected } from '@udecode/plate-selection/react';
import {
  TablePlugin,
  TableRowPlugin,
  useTableCellElement,
} from '@udecode/plate-table/react';
import {
  PlateElement,
  useEditorPlugin,
  useElementSelector,
} from '@udecode/plate/react';

import { blockSelectionVariants } from './block-selection';

export const TableCellElement = withRef<
  typeof PlateElement,
  {
    isHeader?: boolean;
  }
>(({ children, className, isHeader, style, ...props }, ref) => {
  const { api } = useEditorPlugin(TablePlugin);
  const element = props.element as TTableCellElement;

  const rowId = useElementSelector(([node]) => node.id as string, [], {
    key: TableRowPlugin.key,
  });
  const isSelectingRow = useBlockSelected(rowId);
  const { borders, minHeight, selected, width } = useTableCellElement();

  const colSpan = api.table.getColSpan(element);
  const rowSpan = api.table.getRowSpan(element);

  // PlateElement renders by spreading props.attributes onto the DOM element.
  // The plugin's node.props reads from element.attributes.colspan/rowspan (HTML attribute
  // format), but our JSON stores spans as element.colSpan/rowSpan (camelCase top-level).
  // node.props returns undefined for both, which getPluginNodeProps then deletes, so
  // colSpan/rowSpan never reach the DOM. We must inject them into props.attributes here.
  const cellProps = {
    ...props,
    attributes: {
      ...props.attributes,
      ...(colSpan > 1 && { colSpan }),
      ...(rowSpan > 1 && { rowSpan }),
    },
  };

  return (
    <PlateElement
      ref={ref}
      as={isHeader ? 'th' : 'td'}
      className={cn(
        'relative h-full overflow-visible p-0',
        // Use the default editor border only when no parsed border is present.
        // Parsed borders are applied via inline style so the source styling is preserved.
        !element.border && 'border border-gray-200',
        !element.background && 'bg-background',
        cn(
          isHeader && 'text-left [&_>_*]:m-0',
          'before:size-full',
          selected && 'before:z-10 before:bg-muted',
          "before:absolute before:box-border before:select-none before:content-['']"
        ),
        className
      )}
      style={
        {
          ...(element.background ? { backgroundColor: element.background } : {}),
          ...(element.border ? { border: element.border } : {}),
          maxWidth: width || 240,
          minWidth: width || 120,
          ...style,
        } as React.CSSProperties
      }
      {...cellProps}
    >
      <div
        className='relative z-20 box-border h-full px-3 py-2'
        style={{ minHeight }}
      >
        {children}
      </div>

      {isSelectingRow && (
        <div className={blockSelectionVariants()} contentEditable={false} />
      )}
    </PlateElement>
  );
});

export const TableCellHeaderElement = withProps(TableCellElement, {
  isHeader: true,
});
