import { useEffect, useState } from 'react';
import { Heart } from 'lucide-react';
import { api } from '../lib/api';
import { friendlyError } from '../lib/format';

// Heart button for one project. Needs a signed-in user; signed-out visitors are asked to sign in.
export default function FavoriteButton({ projectId, session, onSignIn }) {
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const token = session?.access_token;

  // Is this project already in my list?
  useEffect(() => {
    let ignore = false;
    setSaved(false);
    if (!token) return undefined;
    api('/favorites')
      .then((list) => {
        if (!ignore) setSaved(list.some((item) => item.id === projectId));
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, [projectId, token]);

  async function toggle() {
    if (!session) {
      onSignIn();
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api(`/projects/${projectId}/favorite`, { method: saved ? 'DELETE' : 'PUT' });
      setSaved(!saved);
    } catch (err) {
      setError(friendlyError(err.message));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="favorite">
      <button type="button" className="button button-ghost favorite-button" onClick={toggle} disabled={busy} aria-pressed={saved}>
        <Heart size={18} aria-hidden="true" fill={saved ? 'currentColor' : 'none'} />
        {saved ? 'Saved to favourites' : 'Save to favourites'}
      </button>
      {error && <div className="notice error">{error}</div>}
      <p className="favorite-note">Saved favourites help Fateh follow up with you on projects you like.</p>
    </div>
  );
}
