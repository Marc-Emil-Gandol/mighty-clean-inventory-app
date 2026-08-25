import { X } from "lucide-react";

/**
 * Shared modal — dynamic width, vertical scroll only when content is tall.
 * @param {'sm'|'md'|'lg'|'order'|'auto'} size
 */
export function Modal({ title, children, onClose, size = "md", footer }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className={`modal modal-${size}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="icon-btn icon-btn-neutral" onClick={onClose} type="button">
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}
