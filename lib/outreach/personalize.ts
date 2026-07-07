import type { OutreachLanguage, LeadSignals } from '@/types'

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'

const LANG_NAME: Record<OutreachLanguage, string> = {
  es: 'español',
  en: 'English',
  de: 'Deutsch',
}

interface PersonalizeInput {
  clinicName: string
  language: OutreachLanguage
  website?: string
  signals?: LeadSignals
}

/**
 * Genera una observación breve (1 frase) para personalizar el email de outreach,
 * usando Groq. Si no hay GROQ_API_KEY o la llamada falla, devuelve '' — las
 * plantillas funcionan igual sin observación.
 *
 * NUNCA inventa datos: solo comenta sobre señales reales que se le pasan. Si no
 * hay señales, devuelve '' en vez de fabricar algo.
 */
export async function personalizeObservation(input: PersonalizeInput): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) return ''

  const signalLines = describeSignals(input.signals)
  if (!signalLines) return '' // sin datos reales → no inventar

  const lang = LANG_NAME[input.language]
  const prompt = `Eres un asistente que redacta UNA sola frase de observación para un correo de ventas B2B a una clínica dental, en ${lang}.

Clínica: ${input.clinicName}
${input.website ? `Web: ${input.website}` : ''}
Señales reales detectadas:
${signalLines}

Escribe UNA frase natural en ${lang}, máximo 20 palabras, que mencione una observación concreta basada SOLO en esas señales (por ejemplo, que las citas parecen gestionarse solo por teléfono, o que no tienen reservas online). No saludes, no inventes datos que no estén arriba, no uses el nombre de la clínica. Devuelve solo la frase.`

  try {
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 80,
        temperature: 0.5,
      }),
    })
    if (!res.ok) return ''
    const data = await res.json()
    const text = (data.choices?.[0]?.message?.content ?? '').trim()
    // Limpieza: quitar comillas envolventes si Groq las agrega.
    return text.replace(/^["'“]|["'”]$/g, '').trim()
  } catch {
    return ''
  }
}

function describeSignals(signals?: LeadSignals): string {
  if (!signals) return ''
  const lines: string[] = []
  if (signals.hasOnlineBooking === false) lines.push('- No tiene reservas online')
  if (signals.hasWhatsapp === false) lines.push('- No usa WhatsApp para contacto')
  if (signals.hasChatbot === false) lines.push('- No tiene chatbot / atención automática')
  if (signals.websiteLooksOld) lines.push('- La web parece antigua')
  if (typeof signals.googleRating === 'number') lines.push(`- Rating de Google: ${signals.googleRating}`)
  return lines.join('\n')
}
