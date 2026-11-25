import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Building2 } from 'lucide-react';
import Comments from '../components/Comments';
import ProjectEditForm from '../components/ProjectEditForm';
import ProjectGallery from '../components/ProjectGallery';
import { api } from '../lib/api';
import {
  bedroomsLabel,
  friendlyError,
  priceRange,
  sizeLabel,
  statusLabel,
  typeLabel,
} from '../lib/format';

export default function ProjectDetail({ session, isAdmin, onSignIn }) {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    setError('');
    setEditing(false);
    setSaved(false);
    setProject(null);
    api(`/projects/${id}`)
      .then((data) => {
        if (!ignore) setProject(data);
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
  }, [id]);

  // Reload the project (its main photo may have changed) without showing the loading screen.
  function refreshProject() {
    api(`/projects/${id}`).then(setProject).catch(() => {});
  }

  if (loading) {
    return (
      <div className="page">
        <p className="state">Loading project…</p>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="page">
        <div className="state empty">
          <h1>We could not load this project</h1>
          <p>{error || 'It may have been removed.'}</p>
          <Link to="/properties" className="button button-dark">Back to all properties</Link>
        </div>
      </div>
    );
  }

  const completed = project.status === 'completed';

  return (
    <div className="page detail">
      <Link to={completed ? '/completed-projects' : '/new-projects'} className="back-link">
        <ArrowLeft size={16} aria-hidden="true" />
        Back to {completed ? 'completed projects' : 'new projects'}
      </Link>

      <div className="detail-photo">
        {project.image_url ? (
          <img src={project.image_url} alt={project.name} />
        ) : (
          <div className="card-photo-empty">
            <Building2 size={56} aria-hidden="true" />
            <span>Photo coming soon</span>
          </div>
        )}
      </div>

      <ProjectGallery
        projectId={project.id}
        projectName={project.name}
        isAdmin={isAdmin}
        mainUrl={project.image_url}
        onChanged={refreshProject}
      />

      {editing ? (
        <ProjectEditForm
          project={project}
          onSaved={(updated) => {
            setProject(updated);
            setEditing(false);
            setSaved(true);
          }}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <>
          <div className="detail-head">
            <h1>{project.name}</h1>
            {isAdmin && (
              <button
                type="button"
                className="button button-outline"
                onClick={() => {
                  setSaved(false);
                  setEditing(true);
                }}
              >
                Edit details
              </button>
            )}
          </div>

          {saved && <div className="notice success">Your changes were saved.</div>}

          <div className="detail-body">
            <div className="detail-text">
              <h2>About this project</h2>
              {project.description ? (
                <p>{project.description}</p>
              ) : (
                <p className="muted-text">The description for this project has not been added yet.</p>
              )}
            </div>

            <aside className="glance">
              <h2>At a glance</h2>
              <dl>
                <div><dt>Type</dt><dd>{typeLabel(project)}</dd></div>
                <div><dt>Status</dt><dd>{statusLabel(project.status)}</dd></div>
                <div><dt>Area</dt><dd>{project.area}</dd></div>
                <div><dt>Bedrooms</dt><dd>{bedroomsLabel(project.bedrooms)}</dd></div>
                <div><dt>Size</dt><dd>{sizeLabel(project.sqft)}</dd></div>
                <div><dt>Price range</dt><dd>{priceRange(project.price_min, project.price_max)}</dd></div>
              </dl>
            </aside>
          </div>
        </>
      )}

      <Comments projectId={project.id} session={session} onSignIn={onSignIn} />
    </div>
  );
}
