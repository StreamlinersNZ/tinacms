import React from 'react';
import { useFormPortal, FormBuilder } from '@toolkit/form-builder';
import { PanelHeader, GroupPanel } from '../../group-field-plugin';
import { Form, type Field } from '@toolkit/forms';
import { uuid } from './plugins/ui/helpers';

export const NestedForm = (props: {
  onClose: () => void;
  id: string;
  label: string;
  fields: Field[];
  initialValues: object;
  onChange: (values: object) => void;
}) => {
  const FormPortal = useFormPortal();
  console.log('[TinaCMS Debug] NestedForm received props:', JSON.stringify(props, null, 2));
  const id = React.useMemo(() => uuid(), [props.id, props.initialValues]);
  const form = React.useMemo(() => {
    console.log('[TinaCMS Debug] NestedForm: props.id being used for Form relativePath:', props.id);
    return new Form({
      ...props,
      relativePath: props.id,
      id,
      onChange: ({ values }) => {
        props.onChange(values);
      },
      onSubmit: () => {},
    });
  }, [id, props.onChange, props.fields, props.id, props.initialValues, props.label, props.onClose]);

  return (
    <FormPortal>
      {({ zIndexShift }) => (
        <GroupPanel isExpanded={true} style={{ zIndex: zIndexShift + 1000000 }}>
          <PanelHeader onClick={props.onClose}>{props.label}</PanelHeader>
          <FormBuilder form={{ tinaForm: form }} hideFooter={true} />
        </GroupPanel>
      )}
    </FormPortal>
  );
};
