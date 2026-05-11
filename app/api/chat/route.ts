import { NextRequest, NextResponse } from 'next/server'
import { Timestamp } from 'firebase-admin/firestore'
import { adminDb, adminTimestamp } from '@/lib/firebase-admin'

const org = (orgId: string, sub: string) => adminDb.collection('organizations').doc(orgId).collection(sub)

const SYSTEM_PROMPT = `Eres Alex, el asistente IA de NexoCRM. Eres un miembro más del equipo de ventas.

Puedes actuar directamente sobre el CRM:
- Ver y completar tareas pendientes
- Ver el pipeline de ventas y mover deals entre etapas
- Ver y agendar citas
- Ver resumen de clientes por estado
- Crear tareas, leads y buscar clientes

También puedes redactar mensajes para WhatsApp/Instagram y dar consejos de ventas.

Responde siempre en español. Sé directo. Cuando te pidan hacer algo, usa las herramientas y confirma el resultado.`

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'crear_tarea',
      description: 'Crea una tarea en el CRM asignada al usuario actual',
      parameters: {
        type: 'object',
        properties: {
          titulo: { type: 'string' },
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
          nombre: { type: 'string' },
          telefono: { type: 'string', description: 'Opcional' },
          notas: { type: 'string', description: 'Opcional' },
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
          nombre: { type: 'string' },
        },
        required: ['nombre'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'ver_tareas',
      description: 'Ver las tareas pendientes asignadas al usuario actual',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'ver_pipeline',
      description: 'Ver los deals activos en el pipeline de ventas con su etapa y valor',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'ver_citas',
      description: 'Ver citas programadas del día o la semana',
      parameters: {
        type: 'object',
        properties: {
          periodo: { type: 'string', enum: ['hoy', 'semana'], description: 'hoy o semana' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'ver_resumen_clientes',
      description: 'Ver cuántos clientes hay por estado (lead, prospecto, activo, inactivo)',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'completar_tarea',
      description: 'Marcar una tarea como completada por su título',
      parameters: {
        type: 'object',
        properties: {
          titulo: { type: 'string', description: 'Título o parte del título de la tarea' },
        },
        required: ['titulo'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'mover_deal',
      description: 'Mover un deal a otra etapa del pipeline',
      parameters: {
        type: 'object',
        properties: {
          cliente: { type: 'string', description: 'Nombre del cliente asociado al deal' },
          nueva_etapa: { type: 'string', description: 'Nombre de la nueva etapa' },
        },
        required: ['cliente', 'nueva_etapa'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'agendar_cita',
      description: 'Crear una nueva cita. La fecha debe estar en formato ISO 8601.',
      parameters: {
        type: 'object',
        properties: {
          titulo: { type: 'string' },
          fecha_iso: { type: 'string', description: 'Fecha en formato ISO 8601, ej: 2026-05-12T10:00:00' },
          cliente_nombre: { type: 'string', description: 'Nombre del cliente (opcional)' },
        },
        required: ['titulo', 'fecha_iso'],
      },
    },
  },
]

type Row = Record<string, unknown>

async function executeTool(name: string, args: Record<string, string>, orgId: string, uid: string): Promise<string> {
  const col = (sub: string) => org(orgId, sub)

  // ── Crear tarea ─────────────────────────────────────────────────────────────
  if (name === 'crear_tarea') {
    const ref = await col('tasks').add({
      orgId, title: args.titulo, description: args.descripcion ?? '',
      assignedTo: uid, completed: false, createdAt: adminTimestamp(),
    })
    return JSON.stringify({ ok: true, id: ref.id })
  }

  // ── Crear lead ──────────────────────────────────────────────────────────────
  if (name === 'crear_lead') {
    const ref = await col('clients').add({
      orgId, name: args.nombre, phone: args.telefono ?? '', notes: args.notas ?? '',
      tags: [], photos: [], status: 'lead', assignedTo: uid, createdBy: uid,
      createdAt: adminTimestamp(), updatedAt: adminTimestamp(),
    })
    return JSON.stringify({ ok: true, id: ref.id })
  }

  // ── Buscar clientes ─────────────────────────────────────────────────────────
  if (name === 'buscar_clientes') {
    const snap = await col('clients').limit(40).get()
    const term = args.nombre.toLowerCase()
    const matches = snap.docs
      .map(d => ({ id: d.id, ...d.data() } as Row))
      .filter(c => (c.name as string)?.toLowerCase().includes(term))
      .slice(0, 5)
      .map(c => ({ nombre: c.name, telefono: c.phone, estado: c.status }))
    return JSON.stringify({ clientes: matches, total: matches.length })
  }

  // ── Ver tareas pendientes ───────────────────────────────────────────────────
  if (name === 'ver_tareas') {
    const snap = await col('tasks')
      .where('assignedTo', '==', uid)
      .where('completed', '==', false)
      .orderBy('createdAt', 'desc')
      .limit(10)
      .get()
    const tareas = snap.docs.map(d => {
      const t = d.data() as Row
      const due = t.dueDate ? new Date((t.dueDate as { seconds: number }).seconds * 1000).toLocaleDateString('es') : null
      return { id: d.id, titulo: t.title, descripcion: t.description, vence: due }
    })
    return JSON.stringify({ tareas, total: tareas.length })
  }

  // ── Ver pipeline ────────────────────────────────────────────────────────────
  if (name === 'ver_pipeline') {
    const snap = await col('deals').orderBy('updatedAt', 'desc').limit(20).get()
    const deals = await Promise.all(snap.docs.map(async d => {
      const deal = d.data() as Row
      let cliente = 'Sin cliente'
      try {
        const cDoc = await col('clients').doc(deal.clientId as string).get()
        cliente = (cDoc.data() as Row)?.name as string ?? 'Sin cliente'
      } catch { /* cliente no encontrado */ }
      return { id: d.id, cliente, etapa: deal.stage, valor: deal.value, probabilidad: deal.probability }
    }))
    return JSON.stringify({ deals, total: deals.length })
  }

  // ── Ver citas ───────────────────────────────────────────────────────────────
  if (name === 'ver_citas') {
    const snap = await col('appointments').orderBy('startDate', 'asc').limit(20).get()
    const now = Date.now()
    const limite = args.periodo === 'semana' ? now + 7 * 86400000 : now + 86400000
    const citas = snap.docs
      .map(d => {
        const a = d.data() as Row
        const ts = a.startDate ? (a.startDate as { seconds: number }).seconds * 1000 : 0
        return { id: d.id, titulo: a.title, cliente: a.clientName, fecha: new Date(ts).toLocaleString('es'), ts }
      })
      .filter(c => c.ts >= now && c.ts <= limite)
    return JSON.stringify({ citas, total: citas.length })
  }

  // ── Ver resumen clientes ────────────────────────────────────────────────────
  if (name === 'ver_resumen_clientes') {
    const snap = await col('clients').get()
    const resumen: Record<string, number> = {}
    snap.docs.forEach(d => {
      const s = ((d.data() as Row).status as string) || 'sin_estado'
      resumen[s] = (resumen[s] ?? 0) + 1
    })
    return JSON.stringify({ resumen, total: snap.size })
  }

  // ── Completar tarea ─────────────────────────────────────────────────────────
  if (name === 'completar_tarea') {
    const snap = await col('tasks').where('assignedTo', '==', uid).where('completed', '==', false).limit(30).get()
    const term = args.titulo.toLowerCase()
    const match = snap.docs.find(d => ((d.data() as Row).title as string)?.toLowerCase().includes(term))
    if (!match) return JSON.stringify({ ok: false, error: 'Tarea no encontrada' })
    await match.ref.update({ completed: true })
    return JSON.stringify({ ok: true, titulo: (match.data() as Row).title })
  }

  // ── Mover deal ──────────────────────────────────────────────────────────────
  if (name === 'mover_deal') {
    const clientSnap = await col('clients').limit(40).get()
    const term = args.cliente.toLowerCase()
    const client = clientSnap.docs.find(d => ((d.data() as Row).name as string)?.toLowerCase().includes(term))
    if (!client) return JSON.stringify({ ok: false, error: 'Cliente no encontrado' })
    const dealSnap = await col('deals').where('clientId', '==', client.id).limit(1).get()
    if (dealSnap.empty) return JSON.stringify({ ok: false, error: 'Sin deal para ese cliente' })
    await dealSnap.docs[0].ref.update({ stage: args.nueva_etapa, updatedAt: adminTimestamp() })
    return JSON.stringify({ ok: true, cliente: (client.data() as Row).name, nueva_etapa: args.nueva_etapa })
  }

  // ── Agendar cita ────────────────────────────────────────────────────────────
  if (name === 'agendar_cita') {
    const fecha = new Date(args.fecha_iso)
    let clientId: string | null = null
    let clientName: string | null = null
    if (args.cliente_nombre) {
      const snap = await col('clients').limit(40).get()
      const term = args.cliente_nombre.toLowerCase()
      const match = snap.docs.find(d => ((d.data() as Row).name as string)?.toLowerCase().includes(term))
      if (match) { clientId = match.id; clientName = (match.data() as Row).name as string }
    }
    const ref = await col('appointments').add({
      orgId, title: args.titulo, clientId, clientName, assignedTo: uid,
      startDate: Timestamp.fromDate(isNaN(fecha.getTime()) ? new Date() : fecha),
      createdAt: adminTimestamp(),
    })
    return JSON.stringify({ ok: true, id: ref.id, titulo: args.titulo, fecha: fecha.toLocaleString('es') })
  }

  return JSON.stringify({ error: 'Herramienta desconocida' })
}

async function callGroq(messages: unknown[], withTools = false) {
  const body: Record<string, unknown> = { model: 'llama-3.3-70b-versatile', messages, max_tokens: 1000 }
  if (withTools) { body.tools = TOOLS; body.tool_choice = 'auto' }

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
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
      return NextResponse.json({ reply: finalData.choices[0]?.message?.content, toolsUsed })
    }

    return NextResponse.json({ reply: choice.message.content })
  } catch (e) {
    console.error('[/api/chat]', e)
    return NextResponse.json({ error: 'Error con el servicio de IA' }, { status: 500 })
  }
}
