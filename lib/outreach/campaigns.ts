import type { OutreachLanguage } from '@/types'
import { STOD_TEMPLATES, type OutreachStep, type OutreachTemplate } from './templates'

/**
 * Una campaña = un negocio/producto con su propia cadencia y plantillas.
 * Todas las campañas se envían desde el mismo correo de Agencia
 * (celestialbeamagency@gmail.com); lo que cambia es el nombre de remitente,
 * el copy y el rubro (usado para personalizar con IA).
 *
 * client.product referencia el id de campaña (ej. 'stod').
 */
export interface CampaignDef {
  id: string
  businessLabel: string   // nombre del negocio, ej. "STOD"
  industryLabel: string   // rubro en lenguaje natural, ej. "clínica dental" — usado en el prompt de personalización
  steps: OutreachStep[]
  templates: Record<OutreachLanguage, Partial<Record<OutreachStep, OutreachTemplate>>>
}

export const CAMPAIGNS: Record<string, CampaignDef> = {
  stod: {
    id: 'stod',
    businessLabel: 'STOD',
    industryLabel: 'clínica dental',
    steps: [0, 5, 10, 20],
    templates: STOD_TEMPLATES,
  },
}

const DEFAULT_CAMPAIGN_ID = 'stod'

export function getCampaign(productId?: string): CampaignDef {
  return CAMPAIGNS[productId || DEFAULT_CAMPAIGN_ID] || CAMPAIGNS[DEFAULT_CAMPAIGN_ID]
}
