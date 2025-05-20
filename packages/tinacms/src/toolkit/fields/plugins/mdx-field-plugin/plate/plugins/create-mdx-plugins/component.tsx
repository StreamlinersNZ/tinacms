import React from 'react';
import { Element } from 'slate';
import { useSelected, ReactEditor } from 'slate-react';
import { Transition, Popover, PopoverButton, PopoverPanel } from '@headlessui/react';
import { NestedForm } from '../../nested-form';
import { classNames } from '../ui/helpers';
import { ELEMENT_MDX_INLINE } from '.';
import { EllipsisIcon } from '../ui/icons';
import { useEmbedHandles, useHotkey } from '../../hooks/embed-hooks';
import { useTemplates } from '../../editor-context';
import { insertNodes } from '@udecode/plate-common';
import { ELEMENT_PARAGRAPH } from '@udecode/plate';
import { useCMS } from '@toolkit/react-core';
import get from 'lodash.get';

const Wrapper = ({ inline, children }) => {
  const Component = inline ? 'span' : 'div';
  return (
    <Component contentEditable={false} style={{ userSelect: 'none' }} className="relative">
      {children}
    </Component>
  );
};

export const InlineEmbed = ({ attributes, children, element, onChange, editor }) => {
  console.log(
    '[TinaCMS Debug] InlineEmbed: Initial element received. Name:',
    element.name,
    ' Props:',
    JSON.stringify(element.props, null, 2),
    ' Block ID (element.props.block):',
    element.props?.block
  );

  const selected = useSelected();
  const { templates, fieldName: baseRichTextFieldPath } = useTemplates();
  // const cms = useCMS() as any; // Keep cms for other uses if any, but don't use for formValues for now

  // console.log('[TinaCMS Debug] InlineEmbed: cms.state.activeFormId:', cms.state.activeFormId);
  // const parentForm = cms.forms?.find ? cms.forms.find(cms.state.activeFormId) : undefined;
  // console.log(
  //   '[TinaCMS Debug] InlineEmbed: parentForm found (using cms.forms.find()):',
  //   parentForm ? 'Yes' : 'No'
  // );
  // if (parentForm) {
  //   console.log('[TinaCMS Debug] InlineEmbed: parentForm.id:', parentForm.id);
  //   console.log(
  //     '[TinaCMS Debug] InlineEmbed: parentForm.values (keys only):',
  //     Object.keys(parentForm.values || {})
  //   );
  // }
  const formValues = {}; // Forcibly set to empty to avoid cms.findForm errors and focus on element.props

  const { handleClose, handleRemove, handleSelect, isExpanded } = useEmbedHandles(
    editor,
    element,
    baseRichTextFieldPath
  );
  useHotkey('enter', () => {
    insertNodes(editor, [{ type: ELEMENT_PARAGRAPH, children: [{ text: '' }] }]);
  });
  useHotkey('space', () => {
    insertNodes(editor, [{ text: ' ' }], {
      match: (n) => {
        if (Element.isElement(n) && n.type === ELEMENT_MDX_INLINE) {
          return true;
        }
      },
      select: true,
    });
  });

  const activeTemplate = templates.find((template) => template.name === element.name);

  const slatePath = ReactEditor.findPath(editor, element);
  let valuePathSegments = [baseRichTextFieldPath];
  slatePath.forEach((p) => valuePathSegments.push('children', String(p)));
  valuePathSegments.push('props');
  const pathToElementPropsInForm = valuePathSegments.join('.');
  const nestedFormFieldPrefix = pathToElementPropsInForm;

  // Memoize initialValues based on the content of element.props
  // to prevent re-creating the NestedForm's internal Form instance
  // if element.props is a new object reference but has the same content.
  const stringifiedElementProps = React.useMemo(
    () => JSON.stringify(element.props || {}),
    [element.props]
  );
  const actualInitialValues = React.useMemo(
    () => JSON.parse(stringifiedElementProps),
    [stringifiedElementProps]
  );

  console.log(
    '[TinaCMS Debug] InlineEmbed: actualInitialValues for NestedForm:',
    JSON.stringify(actualInitialValues, null, 2)
  );

  const formPropsForEmbed = {
    activeTemplate,
    element,
    editor,
    onChange,
    onClose: handleClose,
    idForNestedForm: nestedFormFieldPrefix,
    initialValuesForNestedForm: actualInitialValues,
  };

  if (!activeTemplate) {
    return null;
  }

  const label = getLabel(activeTemplate, {
    element: { ...element, props: actualInitialValues },
  });
  return (
    <span {...attributes}>
      {children}
      <Wrapper inline={true}>
        <span
          style={{ margin: '0 0.5px' }}
          className="relative inline-flex shadow-sm rounded-md leading-none"
        >
          {selected && (
            <span className="absolute inset-0 ring-2 ring-blue-100 ring-inset rounded-md z-10 pointer-events-none" />
          )}
          <span
            style={{ fontWeight: 'inherit', maxWidth: '275px' }}
            className="truncate cursor-pointer relative inline-flex items-center justify-start px-2 py-0.5 rounded-l-md border border-gray-200 bg-white  hover:bg-gray-50 focus:z-10 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            onMouseDown={handleSelect}
          >
            {label}
          </span>
          <DotMenu onOpen={handleSelect} onRemove={handleRemove} />
        </span>
        {isExpanded && <EmbedNestedForm {...formPropsForEmbed} />}
      </Wrapper>
    </span>
  );
};

export const BlockEmbed = ({ attributes, children, element, editor, onChange }) => {
  console.log(
    '[TinaCMS Debug] BlockEmbed: Initial element received. Name:',
    element.name,
    ' Props:',
    JSON.stringify(element.props, null, 2),
    ' Block ID (element.props.block):',
    element.props?.block
  );

  const selected = useSelected();
  const { templates, fieldName } = useTemplates();
  // const cms = useCMS() as any; // Keep cms for other uses if any, but don't use for formValues for now

  // console.log('[TinaCMS Debug] BlockEmbed: cms.state.activeFormId:', cms.state.activeFormId);
  // const parentFormBlock = cms.forms?.find ? cms.forms.find(cms.state.activeFormId) : undefined;
  // console.log(
  //   '[TinaCMS Debug] BlockEmbed: parentFormBlock found (using cms.forms.find()):',
  //   parentFormBlock ? 'Yes' : 'No'
  // );
  // if (parentFormBlock) {
  //   console.log('[TinaCMS Debug] BlockEmbed: parentFormBlock.id:', parentFormBlock.id);
  //   console.log(
  //     '[TinaCMS Debug] BlockEmbed: parentFormBlock.values (keys only):',
  //     Object.keys(parentFormBlock.values || {})
  //   );
  // }
  const formValues = {}; // Forcibly set to empty to avoid cms.findForm errors and focus on element.props

  const { handleClose, handleRemove, handleSelect, isExpanded } = useEmbedHandles(
    editor,
    element,
    fieldName
  );

  useHotkey('enter', () => {
    insertNodes(editor, [{ type: ELEMENT_PARAGRAPH, children: [{ text: '' }] }]);
  });

  const activeTemplate = templates.find((template) => template.name === element.name);

  const slatePathBlock = ReactEditor.findPath(editor, element);
  let valuePathSegmentsBlock = [fieldName];
  slatePathBlock.forEach((p) => valuePathSegmentsBlock.push('children', String(p)));
  valuePathSegmentsBlock.push('props');
  const idForNestedForm = valuePathSegmentsBlock.join('.');

  // Memoize initialValues for BlockEmbed as well
  const stringifiedElementPropsBlock = React.useMemo(
    () => JSON.stringify(element.props || {}),
    [element.props]
  );
  const actualInitialValuesBlock = React.useMemo(
    () => JSON.parse(stringifiedElementPropsBlock),
    [stringifiedElementPropsBlock]
  );
  console.log(
    '[TinaCMS Debug] BlockEmbed: actualInitialValues for NestedForm:',
    JSON.stringify(actualInitialValuesBlock, null, 2)
  );

  const formProps = {
    activeTemplate,
    element,
    editor,
    onChange,
    onClose: handleClose,
    idForNestedForm,
    initialValuesForNestedForm: actualInitialValuesBlock,
  };

  if (!activeTemplate) {
    return null;
  }

  const label = getLabel(activeTemplate, formProps);
  return (
    <div {...attributes} className="w-full my-2">
      {children}
      <Wrapper inline={false}>
        <span className="relative w-full inline-flex shadow-sm rounded-md">
          {selected && (
            <span className="absolute inset-0 ring-2 ring-blue-100 ring-inset rounded-md z-10 pointer-events-none" />
          )}
          <span
            onMouseDown={handleSelect}
            className="truncate cursor-pointer w-full relative inline-flex items-center justify-start px-4 py-2 rounded-l-md border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          >
            {label}
          </span>
          <DotMenu onOpen={handleSelect} onRemove={handleRemove} />
        </span>
        {isExpanded && <EmbedNestedForm {...formProps} />}
      </Wrapper>
    </div>
  );
};

const getLabel = (activeTemplate, formProps) => {
  const titleField = activeTemplate.fields.find((field) => field.isTitle);
  let label = activeTemplate.label || activeTemplate.name;
  if (titleField) {
    const propsToUse = formProps.initialValuesForNestedForm || formProps.element.props;
    const titleValue = propsToUse[titleField.name];
    if (titleValue) {
      label = `${label}: ${titleValue}`;
    }
  }

  return label;
};

const EmbedNestedFormNaked = ({
  editor,
  element, // Keep for potential future use or debugging, though not directly used by NestedForm
  activeTemplate,
  onClose,
  onChange,
  idForNestedForm,
  initialValuesForNestedForm,
}) => {
  console.log(
    '[TinaCMS Debug] EmbedNestedForm rendering/re-rendering. id:',
    idForNestedForm,
    'InitialValues:',
    JSON.stringify(initialValuesForNestedForm)
  );
  return (
    <NestedForm
      id={idForNestedForm}
      label={activeTemplate.label} // activeTemplate.label should be primitive
      fields={activeTemplate.fields} // Needs to be stable or deeply compared
      initialValues={initialValuesForNestedForm} // Already memoized by content
      onChange={onChange} // Should be stable from create-mdx-plugins/index.tsx
      onClose={onClose} // This is handleClose from useEmbedHandles, needs to be stable
    />
  );
};

// Custom comparison function for EmbedNestedForm props
const areEmbedNestedFormPropsEqual = (prevProps, nextProps) => {
  const initialValuesEqual =
    JSON.stringify(prevProps.initialValuesForNestedForm) ===
    JSON.stringify(nextProps.initialValuesForNestedForm);
  const fieldsEqual =
    JSON.stringify(prevProps.activeTemplate.fields) ===
    JSON.stringify(nextProps.activeTemplate.fields);
  // Assuming other props are primitives or stable references (onChange, onClose need to be stable)
  return (
    prevProps.idForNestedForm === nextProps.idForNestedForm &&
    prevProps.activeTemplate.label === nextProps.activeTemplate.label &&
    initialValuesEqual &&
    fieldsEqual &&
    prevProps.onChange === nextProps.onChange &&
    prevProps.onClose === nextProps.onClose &&
    prevProps.editor === nextProps.editor && // editor instance should be stable
    prevProps.activeTemplate.name === nextProps.activeTemplate.name // template name itself
  );
};

const EmbedNestedForm = React.memo(EmbedNestedFormNaked, areEmbedNestedFormPropsEqual);

const DotMenu = ({ onOpen, onRemove }) => {
  return (
    <Popover as="span" className="-ml-px relative block">
      <PopoverButton
        as="span"
        className="cursor-pointer h-full relative inline-flex items-center px-1 py-0.5 rounded-r-md border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
      >
        <EllipsisIcon title="Open options" />
      </PopoverButton>
      <Transition
        enter="transition ease-out duration-100"
        enterFrom="transform opacity-0 scale-95"
        enterTo="transform opacity-100 scale-100"
        leave="transition ease-in duration-75"
        leaveFrom="transform opacity-100 scale-100"
        leaveTo="transform opacity-0 scale-95"
      >
        <PopoverPanel className="z-30 absolute origin-top-right right-0">
          <div className="mt-2 -mr-1 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none">
            <div className="py-1">
              <span
                onClick={onOpen}
                className={classNames(
                  'cursor-pointer text-left w-full block px-4 py-2 text-sm hover:bg-gray-100 hover:text-gray-900'
                )}
              >
                Edit
              </span>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onRemove();
                }}
                className={classNames(
                  'cursor-pointer text-left w-full block px-4 py-2 text-sm hover:bg-gray-100 hover:text-gray-900'
                )}
              >
                Remove
              </button>
            </div>
          </div>
        </PopoverPanel>
      </Transition>
    </Popover>
  );
};
