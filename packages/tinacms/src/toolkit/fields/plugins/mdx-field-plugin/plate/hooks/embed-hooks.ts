import React from 'react';
import { Transforms } from 'slate';
import { useSelected, ReactEditor } from 'slate-react';
import { isHotkey } from 'is-hotkey';
import { useCMS, useEvent } from '@toolkit/react-core';
import { FieldFocusEvent } from '@toolkit/fields/field-events';
import { PlateEditor, type TElement } from '@udecode/plate-common';

const handleCloseBase = (editor, element) => {
  const path = ReactEditor.findPath(editor, element);
  const editorEl = ReactEditor.toDOMNode(editor, editor);
  if (editorEl) {
    /**
     * FIXME: there must be a better way to do this. When jumping
     * back from a nested form, the entire editor doesn't receive
     * focus, so enable that, but what we also want is to ensure
     * that this node is selected - so do that, too. But there
     * seems to be a race condition where the `editorEl.focus` doesn't
     * happen in time for the Transform to take effect, hence the
     * setTimeout. I _think_ it just needs to queue and the actual
     * ms timeout is irrelevant, but might be worth checking on
     * devices with lower CPUs
     */
    editorEl.focus();
    setTimeout(() => {
      Transforms.select(editor, path);
    }, 1);
  }
};

const handleRemoveBase = (editor, element) => {
  const path = ReactEditor.findPath(editor, element);
  Transforms.removeNodes(editor, {
    at: path,
  });
};

export const useHotkey = (key, callback) => {
  const selected = useSelected();

  React.useEffect(() => {
    const handleEnter = (e) => {
      if (selected) {
        if (isHotkey(key, e)) {
          e.preventDefault();
          callback();
        }
      }
    };
    document.addEventListener('keydown', handleEnter);

    return () => document.removeEventListener('keydown', handleEnter);
  }, [selected]);
};

export const useEmbedHandles = (
  editor: PlateEditor,
  element: TElement & { props?: { block?: string; [key: string]: unknown } },
  baseFieldName: string
) => {
  const cms = useCMS();
  const { dispatch: setFocusedField } = useEvent<FieldFocusEvent>('field:focus');
  const selected = useSelected();
  const [isExpanded, setIsExpanded] = React.useState(false);

  React.useEffect(() => {
    if (!selected && isExpanded) {
      setIsExpanded(false);
    }
  }, [selected, isExpanded]);

  const handleClose = () => {
    setIsExpanded(false);
    handleCloseBase(editor, element);
  };

  const path = ReactEditor.findPath(editor, element);
  const fieldName = `${baseFieldName}.children.${path.join('.children.')}.props`;

  const handleSelect = () => {
    const currentFormId = cms.state.activeFormId;
    console.log('[TinaCMS Debug] useEmbedHandles - handleSelect triggered (original structure).');
    console.log('[TinaCMS Debug]   Element Name (element.name):', element.name);
    console.log(
      '[TinaCMS Debug]   Element Props (element.props):',
      JSON.stringify(element.props, null, 2)
    );
    console.log('[TinaCMS Debug]   Referenced ID (element.props.block):', element.props?.block);
    console.log('[TinaCMS Debug]   Path to rich-text field (baseFieldName):', baseFieldName);
    console.log(
      '[TinaCMS Debug]   Path to this embed (fieldName calculated as fieldName):',
      fieldName
    );
    console.log('[TinaCMS Debug]   Current document form ID (currentFormId):', currentFormId);

    if (editor.selection && selected) {
      ReactEditor.focus(editor);
      Transforms.select(editor, ReactEditor.findPath(editor, element));
    }

    if (currentFormId) {
      cms.dispatch({
        type: 'forms:set-active-field-name',
        value: {
          formId: currentFormId,
          fieldName,
        },
      });
      setFocusedField({
        id: currentFormId,
        fieldName,
      });
    } else {
      console.warn(
        '[TinaCMS Debug] handleSelect: cms.state.activeFormId is null, cannot set active field.'
      );
    }
    setIsExpanded(true);
  };

  const handleRemove = () => {
    handleRemoveBase(editor, element);
  };

  return { isExpanded, handleClose, handleRemove, handleSelect };
};
