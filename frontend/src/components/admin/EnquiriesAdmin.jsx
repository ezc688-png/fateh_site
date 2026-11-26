import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { friendlyError } from '../../lib/format';

function formatDate(value) {
  return new Date(value).toLocaleString('en-MY', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const JSON_HEADERS = { 'Content-Type': 'application/json' };

// Every "Request a viewing" lead. Change its status as you follow up.
export default function EnquiriesAdmin({ onChanged }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirmId, setConfirmId] = useState(null);

  const load = useCallback(() => {
    return api('/admin/enquiries')
      .then((data) => {
        setItems(data);
        setError('');
      })
      .catch((err) => setError(friendlyError(err.message)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function setStatus(id, status) {
    setError('');
    try {
      await api(`/admin/enquiries/${id}`, { method: 'PUT', headers: JSON_HEADERS, body: JSON.stringify({ status }) });
      setItems((current) => current.map((item) => (item.id === id ? { ...item, status } : item)));
      onChanged?.();
    } catch (err) {
      setError(friendlyError(err.message));
    }
  }

  async function remove(id) {
    setError('');
    try {
      await api(`/admin/enquiries/${id}`, { method: 'DELETE' });
      setItems((current) => current.filter((item) => item.id !== id));
      setConfirmId(null);
      onChanged?.();
    } catch (err) {
      setError(friendlyError(err.message));
    }
  }

  return (
    <section aria-label="Enquiries">
      <div className="admin-toolbar">
        <h2>Viewing requests ({items.length})</h2>
      </div>
      {error && <div className="notice error">{error}</div>}
      {loading && <p className="state">Loading requests…</p>}
      {!loading && items.length === 0 && !error && <p className="state">No viewing requests yet.</p>}

      {items.length > 0 && (
        <ul className="admin-comments">
          {items.map((item) => (
            <li key={item.id} className="admin-comment">
              <div className="admin-comment-head">
                <strong>{item.name}</strong>
                <span className={`status-badge${item.status === 'new' ? ' is-new' : ''}`}>{item.status}</span>
                <span className="muted">{formatDate(item.created_at)}</span>
                {item.project_id ? (
                  <Link to={`/projects/${item.project_id}`} className="admin-project-link">{item.project_name}</Link>
                ) : (
                  <span className="muted">{item.project_name} (deleted)</span>
                )}
              </div>
              <div className="admin-lead-meta">
                <a href={`tel:${item.phone.replace(/[\s-]/g, '')}`}>{item.phone}</a>
                {item.email && <a href={`mailto:${item.email}`}>{item.email}</a>}
                {item.preferred_date && <span>Preferred date: {item.preferred_date}</span>}
                <span className="muted">{item.signed_in ? 'Signed-in user' : 'Visitor'}</span>
              </div>
              {item.message && <p>{item.message}</p>}
              <div className="row-actions">
                <label>
                  <span className="sr-only">Status</span>
                  <select className="status-select" value={item.status} onChange={(e) => setStatus(item.id, e.target.value)}>
                    <option value="new">New</option>
                    <option value="contacted">Contacted</option>
                    <option value="closed">Closed</option>
                  </select>
                </label>
                {confirmId === item.id ? (
                  <>
                    <span className="confirm-text">Delete this request?</span>
                    <button type="button" className="button button-danger" onClick={() => remove(item.id)}>Delete</button>
                    <button type="button" className="button button-ghost" onClick={() => setConfirmId(null)}>Keep</button>
                  </>
                ) : (
                  <button type="button" className="link-button" onClick={() => setConfirmId(item.id)}>Delete</button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
