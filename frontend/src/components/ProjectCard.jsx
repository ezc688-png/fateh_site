import { Link } from 'react-router-dom';
import { BedDouble, Building2, MapPin, Ruler } from 'lucide-react';
import { bedroomsLabel, priceRange, sizeLabel, typeLabel } from '../lib/format';

export default function ProjectCard({ project }) {
  return (
    <Link to={`/projects/${project.id}`} className="project-card">
      <div className="card-photo">
        {project.image_url ? (
          <img src={project.image_url} alt={project.name} loading="lazy" />
        ) : (
          <div className="card-photo-empty">
            <Building2 size={40} aria-hidden="true" />
            <span>Photo coming soon</span>
          </div>
        )}
        <span className="card-tag">{typeLabel(project)}</span>
        {project.status === 'completed' && <span className="card-tag card-tag-status">Completed</span>}
      </div>
      <h3>{project.name}</h3>
      <p className="card-area">
        <MapPin size={15} aria-hidden="true" /> {project.area}
      </p>
      <p className="card-meta">
        <span><BedDouble size={15} aria-hidden="true" /> {bedroomsLabel(project.bedrooms)}</span>
        <span><Ruler size={15} aria-hidden="true" /> {sizeLabel(project.sqft)}</span>
      </p>
      <p className="card-price">{priceRange(project.price_min, project.price_max)}</p>
    </Link>
  );
}
