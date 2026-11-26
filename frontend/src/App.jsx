import { useEffect, useState } from 'react';
import { Link, Route, Routes, useLocation } from 'react-router-dom';
import AskAI from './components/AskAI';
import Auth from './components/Auth';
import Navbar from './components/Navbar';
import SiteFooter from './components/SiteFooter';
import Testimonials from './components/Testimonials';
import { useMe } from './hooks/useMe';
import { useSession } from './hooks/useSession';
import { supabase } from './lib/supabase';
import About from './pages/About';
import Admin from './pages/Admin';
import Favorites from './pages/Favorites';
import Home from './pages/Home';
import Profile from './pages/Profile';
import ProjectDetail from './pages/ProjectDetail';
import ProjectsPage from './pages/ProjectsPage';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function NotFound() {
  return (
    <div className="page">
      <div className="state empty">
        <h1>Page not found</h1>
        <p>The page you are looking for does not exist or has moved.</p>
        <Link to="/" className="button button-dark">Go to the home page</Link>
      </div>
    </div>
  );
}

export default function App() {
  const session = useSession();
  const { me, refreshMe } = useMe(session);
  const isAdmin = Boolean(me?.is_admin);
  const [showAuth, setShowAuth] = useState(false);
  const openSignIn = () => setShowAuth(true);

  return (
    <>
      <ScrollToTop />
      <Navbar
        session={session}
        me={me}
        isAdmin={isAdmin}
        onSignIn={openSignIn}
        onSignOut={() => supabase.auth.signOut()}
      />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route
            path="/properties"
            element={<ProjectsPage title="All properties" intro="Every new and completed project in one place." />}
          />
          <Route
            path="/new-projects"
            element={<ProjectsPage status="new" title="New projects" intro="Projects that are launching or still selling." />}
          />
          <Route
            path="/completed-projects"
            element={<ProjectsPage status="completed" title="Completed projects" intro="Finished projects you can view and move into." />}
          />
          <Route path="/projects/:id" element={<ProjectDetail session={session} me={me} isAdmin={isAdmin} onSignIn={openSignIn} />} />
          <Route path="/about" element={<About />} />
          <Route path="/favourites" element={<Favorites session={session} onSignIn={openSignIn} />} />
          <Route path="/profile" element={<Profile session={session} me={me} onSignIn={openSignIn} onSaved={refreshMe} />} />
          <Route path="/admin" element={<Admin session={session} onSignIn={openSignIn} />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Testimonials session={session} onSignIn={openSignIn} />
      <SiteFooter />
      <AskAI />
      {showAuth && <Auth onClose={() => setShowAuth(false)} />}
    </>
  );
}
