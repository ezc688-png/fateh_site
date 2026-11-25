import { useEffect, useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { api } from '../lib/api';
import { friendlyError } from '../lib/format';
import './Comments.css';

const MAX_LENGTH = 1000;

function formatDate(value) {
  return new Date(value).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' });
}

// One comment. It owns the small UI states that only matter to itself:
// am I being edited, am I asking "are you sure?", and is a request in flight.
function CommentItem({ comment, isOwner, onSave, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [draft, setDraft] = useState(comment.body);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const edited = comment.updated_at !== comment.created_at;

  function startEditing() {
    setDraft(comment.body);
    setError('');
    setEditing(true);
  }

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await onSave(comment.id, draft.trim());
      setEditing(false);
    } catch (err) {
      setError(friendlyError(err.message));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError('');
    try {
      await onDelete(comment.id);
    } catch (err) {
      setError(friendlyError(err.message));
      setBusy(false);
    }
  }

  return (
    <li className="comment">
      <div className="comment-head">
        <strong>{comment.author_name}</strong>
        <span className="comment-date">
          {formatDate(comment.created_at)}
          {edited && ' (edited)'}
        </span>
      </div>

      {editing ? (
        <form className="comment-edit" onSubmit={save}>
          <label className="sr-only" htmlFor={`edit-${comment.id}`}>Edit your comment</label>
          <textarea
            id={`edit-${comment.id}`}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            maxLength={MAX_LENGTH}
            rows={4}
            required
          />
          <div className="comment-actions">
            <button type="submit" className="button button-dark" disabled={busy || !draft.trim()}>
              {busy ? 'Saving…' : 'Save changes'}
            </button>
            <button
              type="button"
              className="button button-ghost"
              disabled={busy}
              onClick={() => {
                setEditing(false);
                setError('');
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <p className="comment-body">{comment.body}</p>
      )}

      {error && <div className="notice error">{error}</div>}

      {isOwner && !editing && (
        <div className="comment-actions" role="group" aria-label="Your comment">
          {confirming ? (
            <>
              <span className="comment-confirm">Delete this comment? This cannot be undone.</span>
              <button type="button" className="button button-danger" onClick={remove} disabled={busy}>
                {busy ? 'Deleting…' : 'Delete comment'}
              </button>
              <button
                type="button"
                className="button button-ghost"
                onClick={() => setConfirming(false)}
                disabled={busy}
              >
                Keep comment
              </button>
            </>
          ) : (
            <>
              <button type="button" className="link-button" onClick={startEditing}>Edit</button>
              <button type="button" className="link-button" onClick={() => setConfirming(true)}>Delete</button>
            </>
          )}
        </div>
      )}
    </li>
  );
}

export default function Comments({ projectId, session, onSignIn }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [wantsToComment, setWantsToComment] = useState(false);
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState('');

  const userId = session?.user?.id;

  // READ: load the comments for this project (public, no login needed).
  useEffect(() => {
    let ignore = false;
    setLoading(true);
    setLoadError('');
    api(`/projects/${projectId}/comments`)
      .then((data) => {
        if (!ignore) setComments(data);
      })
      .catch((err) => {
        if (!ignore) setLoadError(friendlyError(err.message));
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [projectId]);

  // If someone clicked "Leave a comment" while signed out, open the form as soon as they have signed in.
  // If they sign out, close the form.
  useEffect(() => {
    if (!session) {
      setFormOpen(false);
    } else if (wantsToComment) {
      setFormOpen(true);
      setWantsToComment(false);
    }
  }, [session, wantsToComment]);

  function handleLeaveComment() {
    if (!session) {
      setWantsToComment(true);
      onSignIn();
      return;
    }
    setFormOpen(true);
  }

  // CREATE
  async function submit(event) {
    event.preventDefault();
    const body = text.trim();
    if (!body) return;
    setPosting(true);
    setPostError('');
    try {
      const form = new FormData();
      form.append('body', body);
      const created = await api(`/projects/${projectId}/comments`, { method: 'POST', body: form });
      setComments((current) => [created, ...current]);
      setText('');
      setFormOpen(false);
    } catch (err) {
      setPostError(friendlyError(err.message));
    } finally {
      setPosting(false);
    }
  }

  // UPDATE
  async function saveComment(id, body) {
    const form = new FormData();
    form.append('body', body);
    const updated = await api(`/comments/${id}`, { method: 'PUT', body: form });
    setComments((current) => current.map((item) => (item.id === id ? updated : item)));
  }

  // DELETE
  async function deleteComment(id) {
    await api(`/comments/${id}`, { method: 'DELETE' });
    setComments((current) => current.filter((item) => item.id !== id));
  }

  return (
    <section className="comments" id="comments" aria-labelledby="comments-title">
      <div className="comments-head">
        <h2 id="comments-title">
          Comments{!loading && !loadError ? ` (${comments.length})` : ''}
        </h2>
        {!formOpen && (
          <button type="button" className="button button-dark" onClick={handleLeaveComment}>
            <MessageSquare size={18} aria-hidden="true" /> Leave a comment
          </button>
        )}
      </div>

      {!session && (
        <p className="comments-hint">
          You need an account to comment. Select the button to sign in or create one.
        </p>
      )}

      {formOpen && (
        <form className="comment-form" onSubmit={submit}>
          <label htmlFor="new-comment">Your comment</label>
          <textarea
            id="new-comment"
            value={text}
            onChange={(event) => setText(event.target.value)}
            maxLength={MAX_LENGTH}
            rows={4}
            placeholder="Ask a question or share what you think of this project"
            required
          />
          <span className="comment-count">{text.length}/{MAX_LENGTH}</span>
          {postError && <div className="notice error">{postError}</div>}
          <div className="comment-actions">
            <button type="submit" className="button button-dark" disabled={posting || !text.trim()}>
              {posting ? 'Posting…' : 'Post comment'}
            </button>
            <button
              type="button"
              className="button button-ghost"
              disabled={posting}
              onClick={() => {
                setFormOpen(false);
                setPostError('');
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {loadError && <div className="notice error">{loadError}</div>}
      {loading && <p className="state">Loading comments…</p>}

      {!loading && !loadError && comments.length === 0 && (
        <p className="state">No comments yet. Be the first to share what you think of this project.</p>
      )}

      {comments.length > 0 && (
        <ul className="comment-list">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              isOwner={Boolean(userId) && comment.author_id === userId}
              onSave={saveComment}
              onDelete={deleteComment}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
