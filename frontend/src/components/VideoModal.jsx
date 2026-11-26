import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import './VideoModal.css';

// A floating YouTube player over the page. Closes with the X button, the Escape key or a click outside.
// videoId is the 11-character id the backend extracted, so only real YouTube videos can be loaded here.
export default function VideoModal({ videoId, title, onClose }) {
  const closeButton = useRef(null);

  useEffect(() => {
    closeButton.current?.focus();
    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden'; // stop the page scrolling behind the player
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  return (
    <div
      className="video-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="video-dialog" role="dialog" aria-modal="true" aria-label={`${title} video`}>
        <button ref={closeButton} type="button" className="video-close" onClick={onClose} aria-label="Close video">
          <X size={22} aria-hidden="true" />
        </button>
        <div className="video-frame">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`}
            title={`${title} video`}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
          />
        </div>
      </div>
    </div>
  );
}
