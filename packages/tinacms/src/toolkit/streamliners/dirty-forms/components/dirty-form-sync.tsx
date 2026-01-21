import type { FC } from 'react';
import { useEffect } from 'react';
import type { Form } from '../../../forms';
import { dirtyFormStore } from '../utils/store';

export const DirtyFormSync: FC<{ form: Form; pristine: boolean }> = ({
  form,
  pristine,
}) => {
  useEffect(() => {
    if (pristine) {
      dirtyFormStore.markClean(form.id);
      return;
    }
    const dirtyFields = Object.keys(
      form.finalForm.getState().dirtyFields || {}
    );
    dirtyFormStore.markDirty(form, dirtyFields);
  }, [form, pristine]);

  return null;
};
