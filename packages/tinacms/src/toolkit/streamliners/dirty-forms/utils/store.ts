import type { Form } from '../../../forms';

export type DirtyFormEntry = {
  id: Form['id'];
  path: string;
  label: string;
  form: Form;
  dirtyFields?: string[];
  updatedAt: number;
};

type Subscriber = () => void;

class DirtyFormStore {
  private dirtyForms = new Map<Form['id'], DirtyFormEntry>();
  private subscribers = new Set<Subscriber>();

  markDirty(form: Form, dirtyFields?: string[]) {
    this.dirtyForms.set(form.id, {
      id: form.id,
      path: form.path,
      label: form.label,
      form,
      dirtyFields,
      updatedAt: Date.now(),
    });
    this.emit();
  }

  markClean(formId: Form['id']) {
    if (this.dirtyForms.delete(formId)) {
      this.emit();
    }
  }

  isDirty(formId: Form['id']) {
    return this.dirtyForms.has(formId);
  }

  getDirtyForms() {
    return Array.from(this.dirtyForms.values());
  }

  getDirtyFormIds() {
    return Array.from(this.dirtyForms.keys());
  }

  subscribe(callback: Subscriber) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  private emit() {
    this.subscribers.forEach((callback) => callback());
  }
}

export const dirtyFormStore = new DirtyFormStore();
