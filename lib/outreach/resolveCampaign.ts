import { adminDb } from '@/lib/firebase-admin'
import { CAMPAIGNS, getCampaign, type CampaignDef } from './campaigns'

/**
 * Resuelve una campaña para envío real (server-side, Admin SDK): primero
 * revisa las campañas built-in (STOD, Agencia web), y si no coincide,
 * busca una campaña creada desde el CRM en `organizations/{orgId}/campaigns`.
 * Los negocios creados desde el CRM solo soportan español por ahora.
 */
export async function resolveCampaign(orgId: string, productId?: string): Promise<CampaignDef> {
  const id = productId || 'stod'
  if (CAMPAIGNS[id]) return CAMPAIGNS[id]

  const snap = await adminDb.doc(`organizations/${orgId}/outreach_campaigns/${id}`).get()
  if (snap.exists) {
    const d = snap.data() || {}
    return {
      id,
      businessLabel: (d.businessLabel as string) || id,
      industryLabel: (d.industryLabel as string) || 'negocio',
      steps: [0, 5, 10, 20],
      templates: { es: d.templates || {} },
    }
  }
  return getCampaign()
}
