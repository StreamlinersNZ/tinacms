import { useEffect, useState } from 'react';
import { dirtyFormStore } from '../utils/store';

export const useDirtyFormCount = () => {
  const [count, setCount] = useState(dirtyFormStore.getDirtyForms().length);

  useEffect(() => {
    const updateCount = () =>
      setCount(dirtyFormStore.getDirtyForms().length);
    updateCount();
    const unsubscribe = dirtyFormStore.subscribe(updateCount);
    return () => {
      unsubscribe();
    };
  }, []);

  return count;
};
