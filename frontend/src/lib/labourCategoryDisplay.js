const CATEGORY_IMAGES = {
  'ac-technician': 'https://images.unsplash.com/photo-1621905252507-b35492cc74b4?w=400&q=70', // Worker
  'cook-chef': 'https://images.unsplash.com/photo-1577219491135-ce391730fb2c?w=400&q=70',
  'gardener-mali': 'https://images.unsplash.com/photo-1591857177580-dc82b9ac4e1e?w=400&q=70',
  'general-labor-helper': '/service_helper.png',
  'housekeeping-staff': 'https://images.unsplash.com/photo-1584820927508-ea244463426e?w=400&q=70',
  'interior-designer-helper': 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=400&q=70',
  'jcb-operator': '/service_heavy.png',
  'mechanic-2-wheeler': 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=400&q=70',
  'plumber': '/service_plumber.png',
  'construction-helper': '/service_helper.png',
  'crane-operator': '/service_heavy.png',
  'electrician': '/service_electrician.png',
  'glass-installer': 'https://images.unsplash.com/photo-1581094794329-c8112a89af12?w=400&q=70',
  'helper-cook': 'https://images.unsplash.com/photo-1577219491135-ce391730fb2c?w=400&q=70',
  'mechanic-4-wheeler': 'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=400&q=70',
  'office-cleaner': 'https://images.unsplash.com/photo-1584820927508-ea244463426e?w=400&q=70',
}

const FALLBACK_IMAGES = [
  'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400&q=70',
  'https://images.unsplash.com/photo-1581094794329-c8112a89af12?w=400&q=70',
  'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=400&q=70',
  'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=400&q=70',
  'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=400&q=70',
  'https://images.unsplash.com/photo-1581578731548-7f23fd20fb2a?w=400&q=70',
]

function hashSeed(str) {
  let h = 0
  for (let i = 0; i < str.length; i += 1) h = (h * 31 + str.charCodeAt(i)) | 0
  return Math.abs(h)
}

/**
 * Flatten active trade subcategories from grouped API response.
 * @param {Array} tradeGroups
 */
export function flattenTradeSubcategories(tradeGroups) {
  const items = []
  for (const g of tradeGroups || []) {
    for (const c of g.categories || []) {
      items.push({
        _id: c._id,
        name: c.name,
        slug: c.slug,
        subtitle: c.subtitle,
        imageUrl: c.imageUrl || '',
        sortOrder: c.sortOrder ?? 0,
        groupId: g._id,
        groupName: g.name,
      })
    }
  }
  return items.sort((a, b) => (a.sortOrder - b.sortOrder) || String(a.name).localeCompare(String(b.name)))
}

export function getCategoryImageUrl(category) {
  const url = String(category?.imageUrl || '').trim()
  if (url.startsWith('data:image/') || url.startsWith('https://') || url.startsWith('http://')) {
    return url
  }
  const slug = category?.slug || ''
  if (CATEGORY_IMAGES[slug]) {
    return CATEGORY_IMAGES[slug]
  }
  
  // Try matching by name if slug didn't match
  const nameKey = String(category?.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  if (CATEGORY_IMAGES[nameKey]) {
    return CATEGORY_IMAGES[nameKey]
  }

  const key = String(category?.slug || category?.name || 'x')
  return FALLBACK_IMAGES[hashSeed(key) % FALLBACK_IMAGES.length]
}
