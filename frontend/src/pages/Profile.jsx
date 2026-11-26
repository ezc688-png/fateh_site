import { useEffect, useState } from 'react';
import Avatar from '../components/Avatar';
import { api } from '../lib/api';
import { friendlyError } from '../lib/format';
import './Profile.css';

const ROLE_LABEL = { administrator: 'Administrator', user: 'User', banned: 'Restricted' };

// Lets a signed-in user choose a display name and profile photo.
export default function Profile({ session, me, onSignIn, onSaved }) {
  const [name, setName] = useState('');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (me?.display_name) setName(me.display_name);
  }, [me?.display_name]);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  if (!session) {
    return (
      <div className="page">
        <div className="state empty">
          <h1>My profile</h1>
          <p>Sign in to set your display name and photo.</p>
          <button type="button" className="button button-dark" onClick={onSignIn}>Sign in</button>
        </div>
      </div>
    );
  }

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const body = new FormData();
      body.append('display_name', name.trim());
      body.append('remove_avatar', removePhoto && !file ? 'true' : 'false');
      if (file) body.append('avatar', file);
      await api('/profile', { method: 'PUT', body });
      setFile(null);
      setRemovePhoto(false);
      setMessage('Your profile was saved.');
      await onSaved();
    } catch (err) {
      setError(friendlyError(err.message));
    } finally {
      setBusy(false);
    }
  }

  const shownUrl = preview || (removePhoto ? null : me?.avatar_url);

  return (
    <div className="page">
      <header className="page-head">
        <h1>My profile</h1>
        <p>Your name and photo appear on your comments and reviews.</p>
      </header>

      <form className="profile-form" onSubmit={save}>
        <div className="profile-photo">
          <Avatar name={name || me?.display_name} url={shownUrl} size={96} />
          <div>
            <label className="button button-ghost profile-file">
              Choose photo
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) => {
                  setFile(event.target.files?.[0] || null);
                  setRemovePhoto(false);
                }}
              />
            </label>
            {(me?.avatar_url || file) && (
              <button
                type="button"
                className="link-button"
                onClick={() => {
                  setFile(null);
                  setRemovePhoto(true);
                }}
              >
                Remove photo
              </button>
            )}
            <p className="muted">PNG, JPEG or WebP, up to 5 MB.</p>
          </div>
        </div>

        <label className="field">
          Display name
          <input value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={40} required />
        </label>

        <p className="muted">
          Signed in as {session.user.email}
          {me?.role && <> · Role: <strong>{ROLE_LABEL[me.role] || me.role}</strong></>}
        </p>
        {me?.role === 'banned' && (
          <div className="notice error">
            Your account is restricted: you can browse, but you cannot comment, review or send requests.
          </div>
        )}

        {error && <div className="notice error">{error}</div>}
        {message && <div className="notice success">{message}</div>}
        <button type="submit" className="button button-dark" disabled={busy || name.trim().length < 2}>
          {busy ? 'Saving…' : 'Save profile'}
        </button>
      </form>
    </div>
  );
}
