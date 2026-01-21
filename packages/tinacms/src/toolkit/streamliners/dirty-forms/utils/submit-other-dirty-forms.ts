import type { Form } from '../../../forms';
import { dirtyFormStore } from './store';

export const submitOtherDirtyForms = async (activeForm: Form) => {
  const dirtyEntries = dirtyFormStore
    .getDirtyForms()
    .filter((entry) => entry.id !== activeForm.id);
  if (!dirtyEntries.length) {
    return;
  }
  for (const entry of dirtyEntries) {
    if (entry.form.submitting) {
      continue;
    }
    if (!entry.form.valid) {
      continue;
    }
    await entry.form.submit();
  }
};
