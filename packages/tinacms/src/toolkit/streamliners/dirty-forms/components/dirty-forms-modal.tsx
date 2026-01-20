import React, { type FC } from 'react';
import {
  Modal,
  ModalActions,
  ModalBody,
  ModalHeader,
  PopupModal,
} from '../../../react-modals';
import { Button } from '../../../styles';
import type { DirtyFormEntry } from '../utils/store';

const getEntryTitle = (entry: DirtyFormEntry) => {
  const values = entry.form.values as any;
  return values?.title || values?.name || entry.label || 'Document';
};

export const DirtyFormsModal: FC<{
  open: boolean;
  entries: DirtyFormEntry[];
  onClose: () => void;
}> = ({ open, entries, onClose }) => {
  if (!open) return null;

  return (
    <Modal>
      <PopupModal>
        <ModalHeader>Files to be saved</ModalHeader>
        <ModalBody padded={true}>
          {entries.length === 0 ? (
            <p className='text-gray-600 text-sm'>No dirty documents.</p>
          ) : (
            <ul className='text-sm text-gray-800 list-disc pl-5 space-y-1'>
              {entries.map((entry) => (
                <li key={entry.id}>
                  <span className='font-medium'>{getEntryTitle(entry)}</span>
                  <span className='text-gray-500'> — {entry.path}</span>
                </li>
              ))}
            </ul>
          )}
        </ModalBody>
        <ModalActions>
          <Button variant='secondary' onClick={onClose}>
            Close
          </Button>
        </ModalActions>
      </PopupModal>
    </Modal>
  );
};
