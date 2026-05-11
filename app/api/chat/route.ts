import { NextRequest, NextResponse } from 'next/server'
import { adminDb, adminTimestamp } from '@/lib/firebase-admin'

const SYSTEM_PROMPT = `Eres Alex, el asistente IA de NexoCRM. Eres un miembro más del equipo de ventas.

Puedes actuar directamente sobre el CRM:
- Crear tareas para el equipo
- Agregar nuevos leads al pipeline
- Buscar clientes por nombre

También puedes:
- Redactar mensajes profesionales para WhatsApp o Instagram
- Dar consejos de ventas y técnicas de seguimiento
- Responder cualquier duda del equipo

Responde siempre en español. Sé directo y útil. Cuando te pidan crear algo, hazlo con las herramientas y confirma que quedó registrado.`

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'crear_tarea',
      description: 'Crea una tarea en el CRM asignada al usuario actual',
      parameters: {
        type: 'object',
        properties: {
          titulo: { type: 'string', description: 'Título de la tarea' },
          descripcion: { type: 'string', description: 'Descripción opcional' },
        },
        required: ['titulo'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'crear_lead',
      description: 'Crea un nuevo lead o cliente en el CRM',
      parameters: {
        type: 'object',
        properties: {
          nombre: { type: 'string', description: 'Nombre del lead' },
          telefono: { type: 'string', description: 'Teléfono (opcional)' },
          notas: { type: 'string', description: 'Notas adicionales (opcional)' },
        },
        required: ['nombre'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'buscar_clientes',
      description: 'Busca clientes en el CRM por nombre',
      parameters: {
        type: 'object',
        properties: {
          nombre: { type: 'string', description: 'Nombre o parte del nombre a buscar' },
        },
        required: ['nombre'],
      },
    },
  },
]

async function executeTool(
  name: string,
  args: Record<string, string>,
  orgId: string,
  uid: string,
): Promise<string> {
  if (name === 'crear_tarea') {
    const ref = await adminDb.collection('tasks').add({
      orgId,
      title: args.titulo,
      description: args.descripcion ?? '',
      assignedTo: uid,
      completed: false,
      createdAt: adminTimestamp(),
    })
    return JSON.stringify({ ok: true, id: ref.id })
  }

  if (name === 'crear_lead') {
    const ref = await adminDb.collection('clients').add({
      orgId,
      name: args.nombre,
      phone: args.telefono ?? '',
      notes: args.notas ?? '',
      tags: [],
      photos: [],
      status: 'lead',
      assignedTo: uid,
      createdBy: uid,
      createdAt: adminTimestamp(),
      updatedAt: adminTimestamp(),
    })
    return JSON.stringify({ ok: true, id: ref.id })
  }

  if (name === 'buscar_clientes') {
    const snap = await adminDb.collection('clients').where('orgId', '==', orgId).limit(30).get()
    const term = args.nombre.toLowerCase()
    type ClientRow = { id: string; name?: string; phone?: string; status?: string }
    const matches = snap.docs
      .map(d => ({ id: d.id, ...d.data() } as ClientRow))
      .filter(c => c.name?.toLowerCase().includes(term))
      .slice(0, 5)
      .map(c => ({ nombre: c.name, telefono: c.phone, estado: c.status }))
    return JSON.stringify({ clientes: matches, total: matches.length })
  }

  return JSON.stringify({ error: 'Herramienta desconocida' })
}

async function callGroq(messages: unknown[], withTools = false) {
  const body: Record<string, unknown> = {
    model: 'llama-3.3-70b-versatile',
    messages,
    max_tokens: 1000,
  }
  if (withTools) { body.tools = TOOLS; body.tool_choice = 'auto' }

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errText = await res.text()
    console.error(`[/api/chat] Groq ${res.status}:`, errText)
    throw new Error(`Groq ${res.status}: ${errText}`)
  }
  return res.json()
}

export async function POST(req: NextRequest) {
  try {
    const { messages, orgId, uid } = await req.json()
    const fullMessages = [{ role: 'system', content: SYSTEM_PROMPT }, ...messages]

    const data = await callGroq(fullMessages, true)
    const choice = data.choices[0]

    if (choice.finish_reason === 'tool_calls' && orgId && uid) {
      const toolResults: unknown[] = []
      const toolsUsed: string[] = []

      for (const call of choice.message.tool_calls) {
        const args = JSON.parse(call.function.arguments)
        const result = await executeTool(call.function.name, args, orgId, uid)
        toolsUsed.push(call.function.name)
        toolResults.push({ role: 'tool', tool_call_id: call.id, content: result })
      }

      const finalData = await callGroq([...fullMessages, choice.message, ...toolResults])
      return NextResponse.json({
        reply: finalData.choices[0]?.message?.content,
        toolsUsed,
      })
    }

    return NextResponse.json({ reply: choice.message.content })
  } catch (e) {
    console.error('[/api/chat]', e)
    return NextResponse.json({ error: 'Error con el servicio de IA' }, { status: 500 })
  }
}
