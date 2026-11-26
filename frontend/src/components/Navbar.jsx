import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { ChevronDown, Heart, Menu, X } from 'lucide-react';
import { SITE } from '../lib/site';
import Avatar from './Avatar';
import './Account.css';

const PROPERTY_PATHS = ['/properties', '/new-projects', '/completed-projects'];

export default function Navbar({ session, me, isAdmin, onSignIn, onSignOut }) {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  // Close the phone menu after every page change.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const propertiesActive = PROPERTY_PATHS.some((path) => pathname.startsWith(path));
  const userName = me?.display_name || session?.user?.email?.split('@')[0];

  return (
    <header className="site-header">
      <div className="nav-bar">
        <Link to="/" className="brand" aria-label={`${SITE.name} home`}>
          <span className="brand-mark" aria-hidden="true" />
          {SITE.name}
        </Link>

        <button
          className="nav-toggle"
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-controls="site-menu"
          aria-label={open ? 'Close menu' : 'Open menu'}
        >
          {open ? <X size={24} /> : <Menu size={24} />}
        </button>

        <nav id="site-menu" className={`nav-links${open ? ' open' : ''}`} aria-label="Main">
          <NavLink to="/" end className="nav-link">Home</NavLink>

          <div className="nav-item has-menu">
            <NavLink to="/properties" className={`nav-link${propertiesActive ? ' active' : ''}`}>
              Properties <ChevronDown size={15} aria-hidden="true" />
            </NavLink>
            <div className="dropdown">
              <NavLink to="/new-projects" className="dropdown-link">New Project</NavLink>
              <NavLink to="/completed-projects" className="dropdown-link">Completed Project</NavLink>
            </div>
          </div>

          <NavLink to="/about" className="nav-link">About Me</NavLink>
          {isAdmin && <NavLink to="/admin" className="nav-link">Admin</NavLink>}

          <div className="nav-account">
            {session ? (
              <>
                <Link to="/favourites" className="nav-saved" aria-label="My favourites">
                  <Heart size={18} aria-hidden="true" /> Saved
                </Link>
                <Link to="/profile" className="nav-profile" aria-label="My profile">
                  <Avatar name={userName} url={me?.avatar_url} size={30} />
                  <span className="nav-user">{userName}</span>
                </Link>
                <button type="button" className="button button-ghost" onClick={onSignOut}>Sign out</button>
              </>
            ) : (
              <button type="button" className="button button-dark" onClick={onSignIn}>Sign in</button>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}
