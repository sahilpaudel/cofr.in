import React from 'react';

export default function Field({ field, value, onChange }) {
  const id = `f-${field.k}`;
  return (
    <div>
      <label htmlFor={id} className="field-label">
        {field.label}
        {field.required && <span className="field-required">*</span>}
      </label>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        {field.prefix && (
          <span style={{ fontSize: 14, color: 'var(--text-dim)' }}>{field.prefix}</span>
        )}
        {field.type === 'select' ? (
          <select
            id={id}
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className="input-line"
          >
            <option value="" style={{ background: '#161616' }} />
            {field.options.map((o) => (
              <option key={o} value={o} style={{ background: '#161616' }}>
                {o}
              </option>
            ))}
          </select>
        ) : (
          <input
            id={id}
            type={field.type || 'text'}
            step={field.step}
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            className="input-line"
          />
        )}
      </div>
      {field.hint && <div className="field-hint">{field.hint}</div>}
    </div>
  );
}
