import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';

// Asks the backend who is signed in: role, display name and photo. Used to decide what to show.
// The real permission is still checked by the backend on every request.
export function useMe(session) {
  const [me, setMe] = useState(null);
  const token = session?.access_token;

  const refreshMe = useCallback(() => {
    if (!token) {
      setMe(null);
      return Promise.resolve();
    }
    return api('/me')
      .then(setMe)
      .catch(() => setMe(null));
  }, [token]);

  useEffect(() => {
    refreshMe();
  }, [refreshMe]);

  return { me, refreshMe };
}
