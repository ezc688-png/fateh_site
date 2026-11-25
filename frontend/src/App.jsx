import { useEffect, useState } from 'react';
import { Link, Route, Routes, useLocation } from 'react-router-dom';
import Auth from './components/Auth';
import Navbar from './components/Navbar';
import SiteFooter from './components/SiteFooter';
import { useIsAdmin } from './hooks/useIsAdmin';
import { useSession } from './hooks/useSession';
import { supabase } from './lib/supabase';
import About from './pages/About';
import Admin from './pages/Admin';
import Home from './pages/Home';
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
  const isAdmin = useIsAdmin(session);
  const [showAuth, setShowAuth] = useState(false);
  const openSignIn = () => setShowAuth(true);

  return (
    <>
      <ScrollToTop />
      <Navbar
        session={session}
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
          <Route path="/projects/:id" element={<ProjectDetail session={session} isAdmin={isAdmin} onSignIn={openSignIn} />} />
          <Route path="/about" element={<About />} />
          <Route path="/admin" element={<Admin session={session} onSignIn={openSignIn} />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <SiteFooter />
      {showAuth && <Auth onClose={() => setShowAuth(false)} />}
    </>
  );
}
