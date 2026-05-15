import React from 'react';

export default function SectionHeader({ title, caption, action }) {
  return (
    <div className="section-header">
      <div>
        <h2 className="section-title">{title}</h2>
        {caption && <div className="section-caption">{caption}</div>}
      </div>
      {action}
    </div>
  );
}
