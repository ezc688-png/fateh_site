import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { friendlyError } from '../../lib/format';

function formatDate(value) {
  return new Date(value).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function CommentsAdmin({ onChanged }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [confirmId, setConfirmId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  // READ: every comment on the site
  const load = useCallback(() => {
    return api('/admin/comments')
      .then((data) => {
        setComments(data);
        setError('');
      })
      .catch((err) => setError(friendlyError(err.message)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // DELETE: the admin can remove any comment
  async function remove(id) {
    setDeletingId(id);
    setError('');
    try {
      await api(`/admin/comments/${id}`, { method: 'DELETE' });
      setComments((current) => current.filter((item) => item.id !== id));
      setConfirmId(null);
      setMessage('The comment was deleted.');
      onChanged?.();
    } catch (err) {
      setError(friendlyError(err.message));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section aria-label="Comments">
      <div className="admin-toolbar">
        <h2>Comments ({comments.length})</h2>
      </div>

      {message && <div className="notice success">{message}</div>}
      {error && <div className="notice error">{error}</div>}
      {loading && <p className="state">Loading comments…</p>}
      {!loading && comments.length === 0 && !error && <p className="state">No comments yet.</p>}

      {comments.length > 0 && (
        <ul className="admin-comments">
          {comments.map((comment) => (
            <li key={comment.id} className="admin-comment">
              <div className="admin-comment-head">
                <strong>{comment.author}</strong>
                {comment.author_email && comment.author_email !== comment.author && (
                  <span className="muted">{comment.author_email}</span>
                )}
                <span className="muted">{formatDate(comment.created_at)}</span>
                <Link to={`/projects/${comment.project_id}`} className="admin-project-link">
                  {comment.project_name}
                </Link>
              </div>
              <p>{comment.body}</p>
              <div className="row-actions">
                {confirmId === comment.id ? (
                  <>
                    <span className="confirm-text">Delete this comment? This cannot be undone.</span>
                    <button
                      type="button"
                      className="button button-danger"
                      onClick={() => remove(comment.id)}
                      disabled={deletingId === comment.id}
                    >
                      {deletingId === comment.id ? 'Deleting…' : 'Delete comment'}
                    </button>
                    <button type="button" className="button button-ghost" onClick={() => setConfirmId(null)}>
                      Keep
                    </button>
                  </>
                ) : (
                  <button type="button" className="link-button" onClick={() => setConfirmId(comment.id)}>
                    Delete
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
