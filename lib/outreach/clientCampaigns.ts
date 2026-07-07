import { getOutreachCampaigns } from '@/lib/firestore'
import { CAMPAIGNS } from './campaigns'

export interface CampaignOption {
  id: string
  businessLabel: string
  industryLabel: string
}

/**
 * Lista todas las campañas disponibles para una org (uso en componentes
 * cliente): las built-in (STOD, Agencia web) + las creadas desde el CRM.
 */
export async function listAllCampaigns(orgId: string): Promise<CampaignOption[]> {
  const builtins: CampaignOption[] = Object.values(CAMPAIGNS).map(c => ({
    id: c.id, businessLabel: c.businessLabel, industryLabel: c.industryLabel,
  }))
  const custom = await getOutreachCampaigns(orgId)
  const customOpts: CampaignOption[] = custom.map(c => ({
    id: c.id, businessLabel: c.businessLabel, industryLabel: c.industryLabel,
  }))
  return [...builtins, ...customOpts]
}
