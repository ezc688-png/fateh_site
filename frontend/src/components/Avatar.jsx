import './Avatar.css';

// A round profile photo, or the first letter of the name when there is no photo.
export default function Avatar({ name, url, size = 36 }) {
  const initial = (name || '?').trim().charAt(0).toUpperCase();
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.45 }} aria-hidden="true">
      {url ? <img src={url} alt="" /> : initial}
    </span>
  );
}
