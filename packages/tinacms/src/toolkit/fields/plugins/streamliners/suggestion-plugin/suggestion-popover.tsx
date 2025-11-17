'use client';

import React from 'react';

import { AnnotationPopover } from '../discussion-plugin/annotation-popover';

/**
 * @deprecated Replaced by `AnnotationPopover`. This component now renders the unified popover.
 */
export function SuggestionPopover() {
  return <AnnotationPopover />;
}

export default SuggestionPopover;
