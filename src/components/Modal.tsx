import { useEffect, useRef, type ReactNode } from 'react';

const DISCARD_PROMPT = 'Discard the changes you’ve typed? They haven’t been saved.';
import { Icon } from './Icon';
import { Button } from './ui';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  size?: 'md' | 'lg' | 'xl';
}

/** Accessible dialog built on the native <dialog> element (focus trap + Esc for free). */
export function Modal({ open, onClose, title, description, children, size = 'md' }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  /** Set when anything is typed in the dialog, so closing with Esc or × asks before discarding it. */
  const dirty = useRef(false);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dirty.current = false;
      dialog.showModal();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const requestClose = () => {
    if (dirty.current && !window.confirm(DISCARD_PROMPT)) return;
    onClose();
  };

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        requestClose();
      }}
      onInputCapture={() => (dirty.current = true)}
      onChangeCapture={() => (dirty.current = true)}
      aria-labelledby="modal-title"
      className={`m-auto max-h-[90vh] w-[calc(100%-2rem)] overflow-y-auto rounded-xl bg-white p-0 shadow-2xl backdrop:bg-neutral-950/40 ${size === 'xl' ? 'max-w-3xl' : size === 'lg' ? 'max-w-2xl' : 'max-w-lg'}`}
    >
      {open && (
        <div>
          <header className="flex items-start justify-between gap-4 border-b border-neutral-100 px-6 py-4">
            <div>
              <h2 id="modal-title" className="text-base font-semibold text-neutral-950">{title}</h2>
              {description && <p className="mt-0.5 text-sm text-neutral-600">{description}</p>}
            </div>
            <button
              type="button"
              onClick={requestClose}
              className="-mr-1 rounded-md p-1 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
              aria-label="Close dialog"
            >
              <Icon name="x" className="h-5 w-5" />
            </button>
          </header>
          <div className="px-6 py-5">{children}</div>
        </div>
      )}
    </dialog>
  );
}

/** Standard Cancel / Save row at the bottom of a form inside a Modal. */
export function ModalFooter({ onCancel, submitLabel, saving }: { onCancel: () => void; submitLabel: string; saving?: boolean }) {
  return (
    <div className="sticky bottom-0 -mx-6 mt-6 -mb-5 flex justify-end gap-2 border-t border-neutral-100 bg-neutral-50 px-6 py-4">
      <Button variant="secondary" onClick={onCancel}>Cancel</Button>
      <Button type="submit" disabled={saving}>{saving ? 'Saving…' : submitLabel}</Button>
    </div>
  );
}

export function ConfirmDialog({ open, title, message, confirmLabel, onConfirm, onCancel }: {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal open={open} onClose={onCancel} title={title}>
      <div className="text-sm text-neutral-700">{message}</div>
      <div className="-mx-6 mt-6 -mb-5 flex justify-end gap-2 border-t border-neutral-100 bg-neutral-50 px-6 py-4">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button variant="danger" onClick={onConfirm}>{confirmLabel}</Button>
      </div>
    </Modal>
  );
}
