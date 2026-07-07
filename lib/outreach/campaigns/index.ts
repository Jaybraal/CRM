import type { OutreachLanguage } from '@/types'
import { STOD_TEMPLATES, type OutreachStep, type OutreachTemplate } from '../templates'
import { WEBAGENCY_TEMPLATES } from './webagency'

/**
 * Una campaña = un negocio/producto con su propia cadencia y plantillas.
 * Todas las campañas se envían desde el mismo correo de Agencia
 * (celestialbeamagency@gmail.com); lo que cambia es el nombre de remitente,
 * el copy y el rubro (usado para personalizar con IA).
 *
 * client.product referencia el id de campaña (ej. 'stod', 'webagency').
 */
export interface CampaignDef {
  id: string
  businessLabel: string   // nombre de remitente, ej. "STOD", "Agencia"
  industryLabel: string   // rubro por defecto (se usa client.specialty si el lead lo tiene)
  steps: OutreachStep[]
  templates: Partial<Record<OutreachLanguage, Partial<Record<OutreachStep, OutreachTemplate>>>>
}

export const CAMPAIGNS: Record<string, CampaignDef> = {
  stod: {
    id: 'stod',
    businessLabel: 'STOD',
    industryLabel: 'clínica dental',
    steps: [0, 5, 10, 20],
    templates: STOD_TEMPLATES,
  },
  webagency: {
    id: 'webagency',
    businessLabel: 'Agencia',
    industryLabel: 'negocio con producto físico',
    steps: [0, 5, 10, 20],
    templates: WEBAGENCY_TEMPLATES,
  },
}

const DEFAULT_CAMPAIGN_ID = 'stod'

export function getCampaign(productId?: string): CampaignDef {
  return CAMPAIGNS[productId || DEFAULT_CAMPAIGN_ID] || CAMPAIGNS[DEFAULT_CAMPAIGN_ID]
}
