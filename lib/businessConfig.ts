export type BusinessType =
  | 'automotriz'
  | 'restaurante'
  | 'inmobiliaria'
  | 'salud'
  | 'retail'
  | 'servicios'
  | 'ecommerce'
  | 'educacion'
  | 'otro'

export interface BusinessConfig {
  type: BusinessType
  label: string
  emoji: string
  clientLabel: string
  clientsLabel: string
  catalogLabel: string
  categoryLabel: string
  color: string
  pipelineStages: { id: string; name: string; color: string }[]
}

export const BUSINESS_CONFIGS: Record<BusinessType, BusinessConfig> = {
  automotriz: {
    type: 'automotriz', label: 'Automotriz', emoji: '🚗',
    clientLabel: 'Cliente', clientsLabel: 'Clientes',
    catalogLabel: 'Vehículos', categoryLabel: 'Marca / Modelo',
    color: '#6366f1',
    pipelineStages: [
      { id: 'new', name: 'Interesado', color: '#6b7280' },
      { id: 'contacted', name: 'Contactado', color: '#3b82f6' },
      { id: 'negotiation', name: 'Negociación', color: '#f59e0b' },
      { id: 'closed_won', name: 'Vendido', color: '#10b981' },
      { id: 'closed_lost', name: 'Perdido', color: '#ef4444' },
    ],
  },
  restaurante: {
    type: 'restaurante', label: 'Restaurante', emoji: '🍽️',
    clientLabel: 'Comensal', clientsLabel: 'Comensales',
    catalogLabel: 'Menú', categoryLabel: 'Tipo de plato',
    color: '#f97316',
    pipelineStages: [
      { id: 'new', name: 'Reserva', color: '#6b7280' },
      { id: 'contacted', name: 'Confirmado', color: '#3b82f6' },
      { id: 'negotiation', name: 'Evento', color: '#f59e0b' },
      { id: 'closed_won', name: 'Completado', color: '#10b981' },
      { id: 'closed_lost', name: 'Cancelado', color: '#ef4444' },
    ],
  },
  inmobiliaria: {
    type: 'inmobiliaria', label: 'Inmobiliaria', emoji: '🏡',
    clientLabel: 'Comprador', clientsLabel: 'Compradores',
    catalogLabel: 'Propiedades', categoryLabel: 'Zona',
    color: '#10b981',
    pipelineStages: [
      { id: 'new', name: 'Interesado', color: '#6b7280' },
      { id: 'contacted', name: 'Visita', color: '#3b82f6' },
      { id: 'negotiation', name: 'Oferta', color: '#f59e0b' },
      { id: 'closed_won', name: 'Firmado', color: '#10b981' },
      { id: 'closed_lost', name: 'Perdido', color: '#ef4444' },
    ],
  },
  salud: {
    type: 'salud', label: 'Salud', emoji: '🏥',
    clientLabel: 'Paciente', clientsLabel: 'Pacientes',
    catalogLabel: 'Servicios', categoryLabel: 'Especialidad',
    color: '#06b6d4',
    pipelineStages: [
      { id: 'new', name: 'Cita', color: '#6b7280' },
      { id: 'contacted', name: 'Primera consulta', color: '#3b82f6' },
      { id: 'negotiation', name: 'Tratamiento', color: '#f59e0b' },
      { id: 'closed_won', name: 'Alta', color: '#10b981' },
      { id: 'closed_lost', name: 'Cancelado', color: '#ef4444' },
    ],
  },
  retail: {
    type: 'retail', label: 'Retail', emoji: '🛍️',
    clientLabel: 'Cliente', clientsLabel: 'Clientes',
    catalogLabel: 'Productos', categoryLabel: 'Categoría',
    color: '#ec4899',
    pipelineStages: [
      { id: 'new', name: 'Interesado', color: '#6b7280' },
      { id: 'contacted', name: 'Cotización', color: '#3b82f6' },
      { id: 'negotiation', name: 'Pedido', color: '#f59e0b' },
      { id: 'closed_won', name: 'Vendido', color: '#10b981' },
      { id: 'closed_lost', name: 'Cancelado', color: '#ef4444' },
    ],
  },
  servicios: {
    type: 'servicios', label: 'Servicios', emoji: '🔧',
    clientLabel: 'Cliente', clientsLabel: 'Clientes',
    catalogLabel: 'Servicios', categoryLabel: 'Tipo de servicio',
    color: '#8b5cf6',
    pipelineStages: [
      { id: 'new', name: 'Solicitud', color: '#6b7280' },
      { id: 'contacted', name: 'Presupuesto', color: '#3b82f6' },
      { id: 'negotiation', name: 'En progreso', color: '#f59e0b' },
      { id: 'closed_won', name: 'Completado', color: '#10b981' },
      { id: 'closed_lost', name: 'Cancelado', color: '#ef4444' },
    ],
  },
  ecommerce: {
    type: 'ecommerce', label: 'E-commerce', emoji: '🛒',
    clientLabel: 'Comprador', clientsLabel: 'Compradores',
    catalogLabel: 'Productos', categoryLabel: 'Categoría',
    color: '#3b82f6',
    pipelineStages: [
      { id: 'new', name: 'Lead', color: '#6b7280' },
      { id: 'contacted', name: 'Contactado', color: '#3b82f6' },
      { id: 'negotiation', name: 'Carrito', color: '#f59e0b' },
      { id: 'closed_won', name: 'Comprado', color: '#10b981' },
      { id: 'closed_lost', name: 'Abandonado', color: '#ef4444' },
    ],
  },
  educacion: {
    type: 'educacion', label: 'Educación', emoji: '🎓',
    clientLabel: 'Estudiante', clientsLabel: 'Estudiantes',
    catalogLabel: 'Cursos', categoryLabel: 'Área',
    color: '#f59e0b',
    pipelineStages: [
      { id: 'new', name: 'Interesado', color: '#6b7280' },
      { id: 'contacted', name: 'Contactado', color: '#3b82f6' },
      { id: 'negotiation', name: 'Inscripción', color: '#f59e0b' },
      { id: 'closed_won', name: 'Matriculado', color: '#10b981' },
      { id: 'closed_lost', name: 'Descartado', color: '#ef4444' },
    ],
  },
  otro: {
    type: 'otro', label: 'Negocio', emoji: '💼',
    clientLabel: 'Cliente', clientsLabel: 'Clientes',
    catalogLabel: 'Catálogo', categoryLabel: 'Categoría',
    color: '#6366f1',
    pipelineStages: [
      { id: 'new', name: 'Nuevo', color: '#6b7280' },
      { id: 'contacted', name: 'Contactado', color: '#3b82f6' },
      { id: 'negotiation', name: 'Negociación', color: '#f59e0b' },
      { id: 'closed_won', name: 'Ganado', color: '#10b981' },
      { id: 'closed_lost', name: 'Perdido', color: '#ef4444' },
    ],
  },
}

export function getBusinessConfig(type?: string | null): BusinessConfig {
  return BUSINESS_CONFIGS[(type as BusinessType) ?? 'otro'] ?? BUSINESS_CONFIGS.otro
}

export const ALL_BUSINESS_TYPES: { value: BusinessType; label: string; emoji: string }[] = [
  { value: 'automotriz', label: 'Automotriz', emoji: '🚗' },
  { value: 'restaurante', label: 'Restaurante', emoji: '🍽️' },
  { value: 'inmobiliaria', label: 'Inmobiliaria', emoji: '🏡' },
  { value: 'salud', label: 'Salud', emoji: '🏥' },
  { value: 'retail', label: 'Retail', emoji: '🛍️' },
  { value: 'servicios', label: 'Servicios', emoji: '🔧' },
  { value: 'ecommerce', label: 'E-commerce', emoji: '🛒' },
  { value: 'educacion', label: 'Educación', emoji: '🎓' },
  { value: 'otro', label: 'Otro negocio', emoji: '💼' },
]
