'use client';

import React from 'react';

import { AnnotationPopover } from './annotation-popover';

/**
 * @deprecated This component has been superseded by `AnnotationPopover`.
 * It now renders the unified popover to preserve backwards compatibility.
 */
export function CommentPopover() {
  return <AnnotationPopover />;
}

export default CommentPopover;
