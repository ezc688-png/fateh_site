import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { friendlyError, priceRange, statusLabel, typeLabel } from '../../lib/format';

const EMPTY = {
  name: '',
  description: '',
  category: 'condominium',
  status: 'new',
  area: '',
  bedrooms: '',
  sqft: '',
  is_penthouse: false,
  price_min: '',
  price_max: '',
};

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_MB = 5;

// Turn a project coming from the API into the string values the form inputs need.
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

export default function ProjectsAdmin({ onChanged }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  // editing: null (form closed) | 'new' | a project object
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [file, setFile] = useState(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [confirmId, setConfirmId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  // READ
  const load = useCallback(() => {
    return api('/projects')
      .then((data) => {
        setProjects(data);
        setError('');
      })
      .catch((err) => setError(friendlyError(err.message)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openNew() {
    setEditing('new');
    setForm(EMPTY);
    setFile(null);
    setRemoveImage(false);
    setFormError('');
    setMessage('');
  }

  function openEdit(project) {
    setEditing(project);
    setForm(toForm(project));
    setFile(null);
    setRemoveImage(false);
    setFormError('');
    setMessage('');
  }

  function closeForm() {
    setEditing(null);
    setFormError('');
  }

  function setField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function pickFile(event) {
    const picked = event.target.files[0] || null;
    setFormError('');
    if (picked && (!ALLOWED.includes(picked.type) || picked.size > MAX_MB * 1024 * 1024)) {
      setFormError(`The cover picture must be a JPEG, PNG or WebP under ${MAX_MB} MB.`);
      event.target.value = '';
      setFile(null);
      return;
    }
    setFile(picked);
    if (picked) setRemoveImage(false);
  }

  // CREATE (POST) or UPDATE (PUT): same form, different request.
  async function save(event) {
    event.preventDefault();
    setFormError('');

    const min = form.price_min === '' ? null : Number(form.price_min);
    const max = form.price_max === '' ? null : Number(form.price_max);
    if (min !== null && max !== null && min > max) {
      setFormError('The minimum price cannot be higher than the maximum price.');
      return;
    }

    // Optional number fields are only sent when filled in; an empty string would be rejected by the API.
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
    if (file) body.append('image', file);
    if (editing !== 'new' && removeImage && !file) body.append('remove_existing_image', 'true');

    setSaving(true);
    try {
      if (editing === 'new') {
        await api('/projects', { method: 'POST', body });
        setMessage(`"${form.name.trim()}" was added. Open it to upload gallery pictures.`);
      } else {
        await api(`/projects/${editing.id}`, { method: 'PUT', body });
        setMessage(`"${form.name.trim()}" was updated.`);
      }
      setEditing(null);
      await load();
      onChanged?.();
    } catch (err) {
      setFormError(friendlyError(err.message));
    } finally {
      setSaving(false);
    }
  }

  // DELETE
  async function remove(project) {
    setDeletingId(project.id);
    setError('');
    try {
      await api(`/projects/${project.id}`, { method: 'DELETE' });
      setProjects((current) => current.filter((item) => item.id !== project.id));
      setConfirmId(null);
      setMessage(`"${project.name}" was deleted.`);
      onChanged?.();
    } catch (err) {
      setError(friendlyError(err.message));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section aria-label="Projects">
      <div className="admin-toolbar">
        <h2>Projects ({projects.length})</h2>
        {!editing && (
          <button type="button" className="button button-dark" onClick={openNew}>
            Add project
          </button>
        )}
      </div>

      {message && <div className="notice success">{message}</div>}
      {error && <div className="notice error">{error}</div>}

      {editing && (
        <form className="admin-form" onSubmit={save}>
          <h3>{editing === 'new' ? 'Add a project' : `Edit ${editing.name}`}</h3>

          <div className="admin-grid">
            <label className="field wide">
              Title
              <input
                value={form.name}
                onChange={(event) => setField('name', event.target.value)}
                maxLength={160}
                required
              />
            </label>

            <label className="field">
              Type
              <select value={form.category} onChange={(event) => setField('category', event.target.value)}>
                <option value="condominium">Condominium</option>
                <option value="landed">Landed</option>
              </select>
            </label>

            <label className="field">
              Status
              <select value={form.status} onChange={(event) => setField('status', event.target.value)}>
                <option value="new">New project</option>
                <option value="completed">Completed project</option>
              </select>
            </label>

            <label className="field">
              Area
              <input
                value={form.area}
                onChange={(event) => setField('area', event.target.value)}
                placeholder="e.g. Bangsar"
                maxLength={100}
                required
              />
            </label>

            <label className="field">
              Bedrooms
              <input
                type="number"
                min="0"
                value={form.bedrooms}
                onChange={(event) => setField('bedrooms', event.target.value)}
              />
            </label>

            <label className="field">
              Size (sqft)
              <input
                type="number"
                min="0"
                value={form.sqft}
                onChange={(event) => setField('sqft', event.target.value)}
              />
            </label>

            <label className="field">
              Price from (RM)
              <input
                type="number"
                min="0"
                value={form.price_min}
                onChange={(event) => setField('price_min', event.target.value)}
              />
            </label>

            <label className="field">
              Price to (RM)
              <input
                type="number"
                min="0"
                value={form.price_max}
                onChange={(event) => setField('price_max', event.target.value)}
              />
            </label>

            <label className="check wide">
              <input
                type="checkbox"
                checked={form.is_penthouse}
                onChange={(event) => setField('is_penthouse', event.target.checked)}
              />
              This is a penthouse
            </label>

            <label className="field wide">
              Description
              <textarea
                rows={5}
                value={form.description}
                onChange={(event) => setField('description', event.target.value)}
                maxLength={5000}
              />
            </label>

            <div className="field wide">
              <label htmlFor="cover-picture">Cover picture (optional)</label>
              <input id="cover-picture" type="file" accept="image/jpeg,image/png,image/webp" onChange={pickFile} />
              <span className="hint">
                If you leave this empty, the first gallery picture is used as the main photo.
              </span>
              {editing !== 'new' && editing.image_url && (
                <label className="check">
                  <input
                    type="checkbox"
                    checked={removeImage}
                    disabled={Boolean(file)}
                    onChange={(event) => setRemoveImage(event.target.checked)}
                  />
                  Remove the current cover picture
                </label>
              )}
            </div>
          </div>

          {formError && <div className="notice error">{formError}</div>}

          <div className="admin-actions">
            <button type="submit" className="button button-dark" disabled={saving}>
              {saving ? 'Saving…' : editing === 'new' ? 'Add project' : 'Save changes'}
            </button>
            <button type="button" className="button button-ghost" onClick={closeForm} disabled={saving}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading && <p className="state">Loading projects…</p>}

      {!loading && projects.length === 0 && !error && (
        <p className="state">No projects yet. Select Add project to create the first one.</p>
      )}

      {projects.length > 0 && (
        <div className="table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Project</th>
                <th>Area</th>
                <th>Type</th>
                <th>Status</th>
                <th>Price</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => (
                <tr key={project.id}>
                  <td data-label="Project">
                    <strong>{project.name}</strong>
                  </td>
                  <td data-label="Area">{project.area}</td>
                  <td data-label="Type">{typeLabel(project)}</td>
                  <td data-label="Status">{statusLabel(project.status)}</td>
                  <td data-label="Price">{priceRange(project.price_min, project.price_max)}</td>
                  <td data-label="Actions">
                    {confirmId === project.id ? (
                      <div className="row-actions">
                        <span className="confirm-text">Delete this project, its comments and pictures?</span>
                        <button
                          type="button"
                          className="button button-danger"
                          onClick={() => remove(project)}
                          disabled={deletingId === project.id}
                        >
                          {deletingId === project.id ? 'Deleting…' : 'Delete project'}
                        </button>
                        <button type="button" className="button button-ghost" onClick={() => setConfirmId(null)}>
                          Keep
                        </button>
                      </div>
                    ) : (
                      <div className="row-actions">
                        <button type="button" className="link-button" onClick={() => openEdit(project)}>
                          Edit
                        </button>
                        <Link className="link-button" to={`/projects/${project.id}`}>
                          Pictures
                        </Link>
                        <button type="button" className="link-button" onClick={() => setConfirmId(project.id)}>
                          Delete
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
