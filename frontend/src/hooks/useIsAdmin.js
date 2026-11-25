import { useEffect, useState } from 'react';
import { api } from '../lib/api';

// Asks the backend whether the signed-in user is the site owner. Used only to show or hide buttons.
export function useIsAdmin(session) {
  const [isAdmin, setIsAdmin] = useState(false);
  const token = session?.access_token;

  useEffect(() => {
    let ignore = false;
    if (!token) {
      setIsAdmin(false);
      return undefined;
    }
    api('/me')
      .then((data) => {
        if (!ignore) setIsAdmin(Boolean(data.is_admin));
      })
      .catch(() => {
        if (!ignore) setIsAdmin(false);
      });
    return () => {
      ignore = true;
    };
  }, [token]);

  return isAdmin;
}
