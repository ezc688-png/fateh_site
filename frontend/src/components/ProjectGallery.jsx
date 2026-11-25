import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ImagePlus, Star, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { friendlyError } from '../lib/format';
import './ProjectGallery.css';

const MAX_FILES = 10;
const MAX_MB = 5;
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];

// `mainUrl` is the project's current main photo; `onChanged` asks the page to reload it after a change.
export default function ProjectGallery({ projectId, projectName, isAdmin, mainUrl, onChanged }) {
  const [images, setImages] = useState([]);
  const [error, setError] = useState('');
  const [chosen, setChosen] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [confirmId, setConfirmId] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const fileInput = useRef(null);

  const load = useCallback(() => {
    return api(`/projects/${projectId}/images`).then(setImages);
  }, [projectId]);

  // READ: everyone can see the gallery.
  useEffect(() => {
    let ignore = false;
    api(`/projects/${projectId}/images`)
      .then((data) => {
        if (!ignore) setImages(data);
      })
      .catch((err) => {
        if (!ignore) setError(friendlyError(err.message));
      });
    return () => {
      ignore = true;
    };
  }, [projectId]);

  function pickFiles(event) {
    const files = Array.from(event.target.files);
    setError('');
    if (files.length > MAX_FILES) {
      setError(`Choose up to ${MAX_FILES} pictures at a time.`);
      return;
    }
    const bad = files.find((file) => !ALLOWED.includes(file.type) || file.size > MAX_MB * 1024 * 1024);
    if (bad) {
      setError(`"${bad.name}" must be a JPEG, PNG or WebP picture under ${MAX_MB} MB.`);
      return;
    }
    setChosen(files);
  }

  // CREATE: send all chosen files in one request.
  async function upload() {
    setUploading(true);
    setError('');
    try {
      const form = new FormData();
      chosen.forEach((file) => form.append('images', file));
      await api(`/projects/${projectId}/images`, { method: 'POST', body: form });
      await load();
      onChanged?.();
      setChosen([]);
      if (fileInput.current) fileInput.current.value = '';
    } catch (err) {
      setError(friendlyError(err.message));
    } finally {
      setUploading(false);
    }
  }

  // UPDATE: move a picture to the front (main photo) or one step earlier or later.
  async function move(id, direction) {
    setBusyId(id);
    setError('');
    try {
      const form = new FormData();
      form.append('direction', direction);
      const ordered = await api(`/project-images/${id}/move`, { method: 'PUT', body: form });
      setImages(ordered);
      onChanged?.();
    } catch (err) {
      setError(friendlyError(err.message));
    } finally {
      setBusyId(null);
    }
  }

  // DELETE
  async function remove(id) {
    setBusyId(id);
    setError('');
    try {
      await api(`/project-images/${id}`, { method: 'DELETE' });
      setImages((current) => current.filter((image) => image.id !== id));
      setConfirmId(null);
      onChanged?.();
    } catch (err) {
      setError(friendlyError(err.message));
    } finally {
      setBusyId(null);
    }
  }

  if (!isAdmin && images.length === 0) return null;

  return (
    <section className="gallery" aria-label={`${projectName} pictures`}>
      {images.length > 0 && (
        <ul className="gallery-grid">
          {images.map((image, index) => (
            <li key={image.id} className="gallery-item">
              <a href={image.image_url} target="_blank" rel="noreferrer">
                <img src={image.image_url} alt={`${projectName}, picture ${index + 1}`} loading="lazy" />
                {image.image_url === mainUrl && <span className="gallery-badge">Main photo</span>}
              </a>
              {isAdmin && (
                <div className="gallery-admin">
                  {confirmId === image.id ? (
                    <>
                      <button
                        type="button"
                        className="button button-danger"
                        onClick={() => remove(image.id)}
                        disabled={busyId === image.id}
                      >
                        {busyId === image.id ? 'Removing…' : 'Remove picture'}
                      </button>
                      <button type="button" className="button button-ghost" onClick={() => setConfirmId(null)}>
                        Keep
                      </button>
                    </>
                  ) : (
                    <>
                      {index > 0 && (
                        <button
                          type="button"
                          className="link-button"
                          onClick={() => move(image.id, 'first')}
                          disabled={busyId === image.id}
                        >
                          <Star size={15} aria-hidden="true" /> Make main
                        </button>
                      )}
                      {index > 0 && (
                        <button
                          type="button"
                          className="icon-small"
                          onClick={() => move(image.id, 'earlier')}
                          disabled={busyId === image.id}
                          aria-label="Move earlier"
                        >
                          <ArrowLeft size={16} aria-hidden="true" />
                        </button>
                      )}
                      {index < images.length - 1 && (
                        <button
                          type="button"
                          className="icon-small"
                          onClick={() => move(image.id, 'later')}
                          disabled={busyId === image.id}
                          aria-label="Move later"
                        >
                          <ArrowRight size={16} aria-hidden="true" />
                        </button>
                      )}
                      <button type="button" className="link-button" onClick={() => setConfirmId(image.id)}>
                        <Trash2 size={15} aria-hidden="true" /> Remove
                      </button>
                    </>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {isAdmin && (
        <div className="gallery-upload">
          <label className="button button-light" htmlFor={`pictures-${projectId}`}>
            <ImagePlus size={18} aria-hidden="true" /> Choose pictures
          </label>
          <input
            id={`pictures-${projectId}`}
            ref={fileInput}
            className="sr-only"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={pickFiles}
          />
          {chosen.length > 0 && (
            <>
              <span className="gallery-chosen">
                {chosen.length} {chosen.length === 1 ? 'picture' : 'pictures'} selected
              </span>
              <button type="button" className="button button-dark" onClick={upload} disabled={uploading}>
                {uploading ? 'Uploading…' : 'Upload pictures'}
              </button>
            </>
          )}
        </div>
      )}

      {error && <div className="notice error">{error}</div>}
    </section>
  );
}
