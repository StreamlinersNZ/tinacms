import type { Form } from '../../../forms';
import { dirtyFormStore } from './store';

export const attachDirtyFormTracking = (form: Form) => {
  form.finalForm.subscribe(
    ({ dirty, dirtyFields }) => {
      if (!dirty) return;
      dirtyFormStore.markDirty(form, Object.keys(dirtyFields || {}));
    },
    { dirty: true, dirtyFields: true }
  );
};
