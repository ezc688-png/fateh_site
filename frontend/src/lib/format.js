const ringgit = (value) => `RM ${Number(value).toLocaleString('en-MY')}`;

export function priceRange(min, max) {
  const hasMin = min !== null && min !== undefined;
  const hasMax = max !== null && max !== undefined;
  if (hasMin && hasMax) return min === max ? ringgit(min) : `${ringgit(min)} – ${ringgit(max)}`;
  if (hasMin) return `From ${ringgit(min)}`;
  if (hasMax) return `Up to ${ringgit(max)}`;
  return 'Price on request';
}

export function sizeLabel(sqft) {
  return sqft ? `${Number(sqft).toLocaleString('en-MY')} sqft` : 'Not stated';
}

export function bedroomsLabel(count) {
  if (count === null || count === undefined) return 'Not stated';
  return count === 1 ? '1 bedroom' : `${count} bedrooms`;
}

export function typeLabel(project) {
  if (project.is_penthouse) return 'Penthouse';
  return project.category === 'landed' ? 'Landed' : 'Condominium';
}

export function statusLabel(status) {
  return status === 'completed' ? 'Completed' : 'New project';
}

export function friendlyError(message) {
  if (/failed to fetch|networkerror/i.test(message || '')) {
    return 'Cannot reach the server. Check that the backend is running on port 8000.';
  }
  return message;
}
