/** Display initials from a person's full name (e.g. for avatars). */
export function initialsFromName(name) {
  if (!name?.trim()) return '?'
  const parts = name.trim().split(/\s+/)
  const a = parts[0]?.[0]
  const b = parts.length > 1 ? parts[parts.length - 1]?.[0] : ''
  return `${a || ''}${b || ''}`.toUpperCase() || '?'
}
