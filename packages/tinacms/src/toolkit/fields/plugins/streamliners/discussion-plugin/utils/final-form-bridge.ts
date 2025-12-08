import React from 'react';

/**
 * Registers the annotations field with Final Form so changes to
 * `annotations.entries` mark the form as dirty (enables the Tina Save button)
 * even when the main rich-text value is unchanged.
 */
export const useRegisterAnnotationsField = (
  tinaForm: { finalForm?: { registerField: Function } } | undefined,
  fieldPath = 'annotations.entries'
) => {
  React.useEffect(() => {
    const form = tinaForm?.finalForm;
    if (!form?.registerField) return;

    const unregister = form.registerField(fieldPath, () => undefined, {});
    return () => {
      unregister?.();
    };
  }, [tinaForm, fieldPath]);
};
