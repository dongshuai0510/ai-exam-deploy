import { SavedTemplate, ColumnMapping } from '@/types/order'

const STORAGE_KEY = 'excel_import_templates'

export function getSavedTemplates(): SavedTemplate[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveTemplate(headerKey: string, mapping: ColumnMapping): SavedTemplate {
  const templates = getSavedTemplates()
  const existing = templates.findIndex(t => t.headerKey === headerKey)
  const template: SavedTemplate = {
    id: existing >= 0 ? templates[existing].id : crypto.randomUUID(),
    headerKey,
    mapping,
    createdAt: new Date().toISOString(),
  }
  if (existing >= 0) {
    templates[existing] = template
  } else {
    templates.push(template)
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates))
  return template
}

export function deleteTemplate(id: string) {
  const templates = getSavedTemplates().filter(t => t.id !== id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates))
}
