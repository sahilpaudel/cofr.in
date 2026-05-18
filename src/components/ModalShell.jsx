import React, { useEffect } from 'react';

export default function ModalShell({ children, onClose, maxWidth = 560 }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);

    // Lock the app-shell scroll container (body is always overflow:hidden on iOS).
    const shell = document.querySelector('.app-shell');
    if (shell) shell.style.overflowY = 'hidden';

    return () => {
      window.removeEventListener('keydown', onKey);
      if (shell) shell.style.overflowY = '';
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
