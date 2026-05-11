import { NextRequest, NextResponse } from 'next/server'

const SYSTEM_PROMPT = `Eres el asistente de NexoCRM. Ayudas a agentes y gerentes de ventas a:
- Redactar mensajes efectivos para WhatsApp e Instagram
- Gestionar leads, clientes y oportunidades en el pipeline
- Mejorar estrategias de ventas y seguimiento
- Responder dudas sobre el CRM y buenas prácticas comerciales

Responde siempre en español, de forma concisa y práctica. No inventes datos de clientes reales.`

export async function POST(req: NextRequest) {
  const { messages } = await req.json()

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama3-8b-8192',
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
      max_tokens: 500,
    }),
  })

  if (!res.ok) return NextResponse.json({ error: 'Error con el servicio de IA' }, { status: 500 })

  const data = await res.json()
  return NextResponse.json({ reply: data.choices[0]?.message?.content ?? 'Sin respuesta' })
}
