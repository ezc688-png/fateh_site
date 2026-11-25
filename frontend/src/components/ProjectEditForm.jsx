import { useState } from 'react';
import { api } from '../lib/api';
import { friendlyError } from '../lib/format';
import './ProjectEditForm.css';

// Turn the project from the API into the string values the inputs need.
function toForm(project) {
  return {
    name: project.name || '',
    description: project.description || '',
    category: project.category,
    status: project.status,
    area: project.area || '',
    bedrooms: project.bedrooms ?? '',
    sqft: project.sqft ?? '',
    is_penthouse: Boolean(project.is_penthouse),
    price_min: project.price_min ?? '',
    price_max: project.price_max ?? '',
  };
}

// Replaces the title, description and "At a glance" column while the admin is editing.
// Pictures are handled by the gallery above, so this form never touches them.
export default function ProjectEditForm({ project, onSaved, onCancel }) {
  const [form, setForm] = useState(() => toForm(project));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function setField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  // UPDATE: send the form to PUT /projects/{id}. The backend re-checks that you are the admin.
  async function save(event) {
    event.preventDefault();
    setError('');

    const min = form.price_min === '' ? null : Number(form.price_min);
    const max = form.price_max === '' ? null : Number(form.price_max);
    if (min !== null && max !== null && min > max) {
      setError('The minimum price cannot be higher than the maximum price.');
      return;
    }

    // Optional number fields are only sent when filled in; an empty string would be rejected.
    const body = new FormData();
    body.append('name', form.name.trim());
    body.append('description', form.description.trim());
    body.append('category', form.category);
    body.append('status', form.status);
    body.append('area', form.area.trim());
    body.append('is_penthouse', form.is_penthouse ? 'true' : 'false');
    ['bedrooms', 'sqft', 'price_min', 'price_max'].forEach((key) => {
      if (form[key] !== '') body.append(key, form[key]);
    });

    setSaving(true);
    try {
      const updated = await api(`/projects/${project.id}`, { method: 'PUT', body });
      onSaved(updated);
    } catch (err) {
      setError(friendlyError(err.message));
      setSaving(false);
    }
  }

  return (
    <form className="edit-form" onSubmit={save}>
      <div className="edit-layout">
        <div className="edit-main">
          <label className="edit-field">
            Title
            <input
              className="edit-title"
              value={form.name}
              onChange={(event) => setField('name', event.target.value)}
              maxLength={160}
              required
            />
          </label>

          <label className="edit-field">
            Description
            <textarea
              rows={10}
              value={form.description}
              onChange={(event) => setField('description', event.target.value)}
              maxLength={5000}
            />
          </label>
        </div>

        <aside className="glance edit-glance">
          <h2>At a glance</h2>

          <label className="edit-field">
            Type
            <select value={form.category} onChange={(event) => setField('category', event.target.value)}>
              <option value="condominium">Condominium</option>
              <option value="landed">Landed</option>
            </select>
          </label>

          <label className="edit-check">
            <input
              type="checkbox"
              checked={form.is_penthouse}
              onChange={(event) => setField('is_penthouse', event.target.checked)}
            />
            This is a penthouse
          </label>

          <label className="edit-field">
            Status
            <select value={form.status} onChange={(event) => setField('status', event.target.value)}>
              <option value="new">New project</option>
              <option value="completed">Completed project</option>
            </select>
          </label>

          <label className="edit-field">
            Area
            <input
              value={form.area}
              onChange={(event) => setField('area', event.target.value)}
              maxLength={100}
              required
            />
          </label>

          <label className="edit-field">
            Bedrooms
            <input
              type="number"
              min="0"
              value={form.bedrooms}
              onChange={(event) => setField('bedrooms', event.target.value)}
            />
          </label>

          <label className="edit-field">
            Size (sqft)
            <input
              type="number"
              min="0"
              value={form.sqft}
              onChange={(event) => setField('sqft', event.target.value)}
            />
          </label>

          <label className="edit-field">
            Price from (RM)
            <input
              type="number"
              min="0"
              value={form.price_min}
              onChange={(event) => setField('price_min', event.target.value)}
            />
          </label>

          <label className="edit-field">
            Price to (RM)
            <input
              type="number"
              min="0"
              value={form.price_max}
              onChange={(event) => setField('price_max', event.target.value)}
            />
          </label>
        </aside>
      </div>

      {error && <div className="notice error">{error}</div>}

      <div className="edit-actions">
        <button type="submit" className="button button-dark" disabled={saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </button>
        <button type="button" className="button button-ghost" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
      </div>
    </form>
  );
}
