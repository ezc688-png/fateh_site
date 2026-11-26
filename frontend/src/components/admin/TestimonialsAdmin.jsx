import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { friendlyError } from '../../lib/format';

function formatDate(value) {
  return new Date(value).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' });
}

const JSON_HEADERS = { 'Content-Type': 'application/json' };

// Reviews need your approval before they show on the site.
export default function TestimonialsAdmin({ onChanged }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirmId, setConfirmId] = useState(null);

  useEffect(() => {
    let ignore = false;
    api('/admin/testimonials')
      .then((data) => {
        if (!ignore) setItems(data);
      })
      .catch((err) => {
        if (!ignore) setError(friendlyError(err.message));
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, []);

  async function setApproved(id, approved) {
    setError('');
    try {
      await api(`/admin/testimonials/${id}`, { method: 'PUT', headers: JSON_HEADERS, body: JSON.stringify({ approved }) });
      setItems((current) => current.map((item) => (item.id === id ? { ...item, approved } : item)));
      onChanged?.();
    } catch (err) {
      setError(friendlyError(err.message));
    }
  }

  async function remove(id) {
    setError('');
    try {
      await api(`/admin/testimonials/${id}`, { method: 'DELETE' });
      setItems((current) => current.filter((item) => item.id !== id));
      setConfirmId(null);
      onChanged?.();
    } catch (err) {
      setError(friendlyError(err.message));
    }
  }

  return (
    <section aria-label="Reviews">
      <div className="admin-toolbar">
        <h2>Reviews ({items.length})</h2>
      </div>
      <p className="muted">Waiting reviews are listed first. Only approved reviews appear on the website.</p>
      {error && <div className="notice error">{error}</div>}
      {loading && <p className="state">Loading reviews…</p>}
      {!loading && items.length === 0 && !error && <p className="state">No reviews yet.</p>}

      {items.length > 0 && (
        <ul className="admin-comments">
          {items.map((item) => (
            <li key={item.id} className="admin-comment">
              <div className="admin-comment-head">
                <strong>{item.author_name}</strong>
                {item.author_email && <span className="muted">{item.author_email}</span>}
                <span className="admin-stars" aria-label={`${item.rating} out of 5`}>{'★'.repeat(item.rating)}{'☆'.repeat(5 - item.rating)}</span>
                <span className="muted">{formatDate(item.created_at)}</span>
                <span className={`status-badge${item.approved ? '' : ' is-new'}`}>{item.approved ? 'Approved' : 'Waiting'}</span>
              </div>
              <p>{item.body}</p>
              <div className="row-actions">
                {item.approved ? (
                  <button type="button" className="button button-ghost" onClick={() => setApproved(item.id, false)}>Hide</button>
                ) : (
                  <button type="button" className="button button-dark" onClick={() => setApproved(item.id, true)}>Approve</button>
                )}
                {confirmId === item.id ? (
                  <>
                    <span className="confirm-text">Delete this review?</span>
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
