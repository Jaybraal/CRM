'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { getOrganization, updateOrganization } from '@/lib/firestore'
import BaileysQR from '@/components/settings/BaileysQR'
import { inputClass, labelClass } from '@/components/ui/primitives'
import toast from 'react-hot-toast'

const INDUSTRY_OPTIONS = [
  'Restaurante',
  'Real Estate / Inmobiliaria',
  'Clínica / Salud',
  'Taller mecánico',
  'Agencia de marketing',
  'Salón / Spa',
  'Otro',
]

export default function OnboardingPage() {
  const { profile } = useAuth()
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)

  // Step 2 — Bot
  const [n8nWebhookUrl, setN8nWebhookUrl] = useState('')
  const [n8nApiKey, setN8nApiKey] = useState('')
  const [n8nMode, setN8nMode] = useState<'always' | 'outside_hours' | 'off'>('off')

  // Step 3 — Business
  const [businessName, setBusinessName] = useState('')
  const [industry, setIndustry] = useState('')
  const [openTime, setOpenTime] = useState('08:00')
  const [closeTime, setCloseTime] = useState('18:00')

  const orgId = profile?.orgId

  const saveStep2 = async () => {
    if (!orgId) return
    setSaving(true)
    try {
      const org = await getOrganization(orgId)
      if (!org) throw new Error('Org no encontrada')
      await updateOrganization(orgId, {
        settings: {
          ...org.settings,
          n8nWebhookUrl: n8nWebhookUrl.trim(),
          n8nApiKey: n8nApiKey.trim(),
          n8nMode,
        },
      })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar bot')
      throw e
    } finally {
      setSaving(false)
    }
  }

  const saveStep3AndFinish = async () => {
    if (!orgId) return
    setSaving(true)
    try {
      const org = await getOrganization(orgId)
      if (!org) throw new Error('Org no encontrada')
      await updateOrganization(orgId, {
        name: businessName || org.name,
        settings: {
          ...org.settings,
          industry,
          onboardingCompleted: true,
          businessHours: {
            ...org.settings.businessHours,
            days: org.settings.businessHours?.days ?? [1, 2, 3, 4, 5],
            openTime,
            closeTime,
            slotMinutes: org.settings.businessHours?.slotMinutes ?? 60,
          },
        },
      })
      router.replace('/dashboard')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar')
      throw e
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F4F5F7] dark:bg-[#080E1C] flex flex-col items-center justify-center px-4 py-12">
      {/* Logo */}
      <div className="mb-8">
        <span className="text-[#0C1224] dark:text-white font-bold text-2xl tracking-[0.2em]">NX</span>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-3 mb-8">
        {[1, 2, 3].map(s => (
          <div key={s} className="flex items-center gap-3">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                s === step
                  ? 'bg-[#0D7A65] text-white'
                  : s < step
                  ? 'bg-[#0D7A65]/20 text-[#0D7A65]'
                  : 'bg-[#E3E6EC] dark:bg-[#1A2540] text-[#9BA5B7]'
              }`}
            >
              {s}
            </div>
            {s < 3 && (
              <div className={`w-8 h-0.5 ${s < step ? 'bg-[#0D7A65]' : 'bg-[#E3E6EC] dark:bg-[#1A2540]'}`} />
            )}
          </div>
        ))}
      </div>

      <div className="w-full max-w-md bg-white dark:bg-[#0C1224] rounded-xl shadow-xl border border-[#E3E6EC] dark:border-[#1A2540] p-8 space-y-6">

        {/* STEP 1 — WhatsApp */}
        {step === 1 && (
          <>
            <div>
              <h1 className="text-xl font-bold text-[#0C1224] dark:text-white">Conecta WhatsApp</h1>
              <p className="text-sm text-[#68748D] dark:text-[#9BA5B7] mt-1">Escanea el QR para vincular tu número de WhatsApp.</p>
            </div>
            {orgId && <BaileysQR orgId={orgId} />}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="flex-1 px-4 py-2.5 border border-[#E3E6EC] dark:border-[#1A2540] text-sm text-[#68748D] dark:text-[#9BA5B7] rounded-md hover:bg-[#F4F5F7] dark:hover:bg-[#1A2540] transition-colors font-semibold"
              >
                Omitir
              </button>
              <button
                type="button"
                onClick={() => setStep(2)}
                className="flex-1 px-4 py-2.5 bg-[#0D7A65] hover:bg-[#0B6B57] text-white text-sm font-bold rounded-md transition-colors"
              >
                Continuar
              </button>
            </div>
          </>
        )}

        {/* STEP 2 — Bot N8N */}
        {step === 2 && (
          <>
            <div>
              <h1 className="text-xl font-bold text-[#0C1224] dark:text-white">Configura tu Bot N8N</h1>
              <p className="text-sm text-[#68748D] dark:text-[#9BA5B7] mt-1">Conecta tu flujo de N8N para calificar leads automáticamente.</p>
            </div>
            <div className="space-y-4">
              <div>
                <label className={labelClass}>URL del webhook</label>
                <input
                  type="url"
                  value={n8nWebhookUrl}
                  onChange={e => setN8nWebhookUrl(e.target.value)}
                  className={inputClass}
                  placeholder="https://mi-n8n.com/webhook/..."
                />
              </div>
              <div>
                <label className={labelClass}>API Key (opcional)</label>
                <input
                  type="password"
                  value={n8nApiKey}
                  onChange={e => setN8nApiKey(e.target.value)}
                  className={inputClass}
                  placeholder="sk-..."
                />
              </div>
              <div>
                <label className={labelClass}>Modo de activación</label>
                <div className="space-y-2 mt-1">
                  {([
                    { value: 'always', label: 'Siempre activo' },
                    { value: 'outside_hours', label: 'Solo fuera de horario' },
                    { value: 'off', label: 'Desactivado por ahora' },
                  ] as const).map(opt => (
                    <label key={opt.value} className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="radio"
                        name="n8nMode"
                        value={opt.value}
                        checked={n8nMode === opt.value}
                        onChange={() => setN8nMode(opt.value)}
                        className="accent-[#0D7A65]"
                      />
                      <span className="text-sm text-[#0C1224] dark:text-[#E8ECF4]">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="flex-1 px-4 py-2.5 border border-[#E3E6EC] dark:border-[#1A2540] text-sm text-[#68748D] dark:text-[#9BA5B7] rounded-md hover:bg-[#F4F5F7] dark:hover:bg-[#1A2540] transition-colors font-semibold"
              >
                Omitir
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={async () => {
                  try { await saveStep2(); setStep(3) } catch { /* handled */ }
                }}
                className="flex-1 px-4 py-2.5 bg-[#0D7A65] hover:bg-[#0B6B57] disabled:opacity-50 text-white text-sm font-bold rounded-md transition-colors"
              >
                {saving ? 'Guardando...' : 'Continuar'}
              </button>
            </div>
          </>
        )}

        {/* STEP 3 — Business info */}
        {step === 3 && (
          <>
            <div>
              <h1 className="text-xl font-bold text-[#0C1224] dark:text-white">Cuéntanos de tu negocio</h1>
              <p className="text-sm text-[#68748D] dark:text-[#9BA5B7] mt-1">Estos datos ayudan al bot a entender tu contexto.</p>
            </div>
            <div className="space-y-4">
              <div>
                <label className={labelClass}>Nombre del negocio</label>
                <input
                  value={businessName}
                  onChange={e => setBusinessName(e.target.value)}
                  className={inputClass}
                  placeholder="Mi empresa S.A."
                />
              </div>
              <div>
                <label className={labelClass}>Industria / Sector</label>
                <select
                  value={industry}
                  onChange={e => setIndustry(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Selecciona...</option>
                  {INDUSTRY_OPTIONS.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Hora apertura</label>
                  <input
                    type="time"
                    value={openTime}
                    onChange={e => setOpenTime(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Hora cierre</label>
                  <input
                    type="time"
                    value={closeTime}
                    onChange={e => setCloseTime(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>
            </div>
            <button
              type="button"
              disabled={saving}
              onClick={saveStep3AndFinish}
              className="w-full px-4 py-2.5 bg-[#0D7A65] hover:bg-[#0B6B57] disabled:opacity-50 text-white text-sm font-bold rounded-md transition-colors"
            >
              {saving ? 'Guardando...' : 'Ir al dashboard'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
