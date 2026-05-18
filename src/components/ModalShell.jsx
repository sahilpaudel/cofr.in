import React, { useEffect } from 'react';

export default function ModalShell({ children, onClose, maxWidth = 560 }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);

    const shell = document.querySelector('.app-shell');
    if (shell) shell.style.overflowY = 'hidden';
    document.body.setAttribute('data-modal-open', '');

    return () => {
      window.removeEventListener('keydown', onKey);
      if (shell) shell.style.overflowY = '';
      document.body.removeAttribute('data-modal-open');
    };
  }, [onClose]);

  return (
    <div className="modal-overlay backdrop fade" onClick={onClose}>
      <div
        className="modal"
        style={{ maxWidth }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
