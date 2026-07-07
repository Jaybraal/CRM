import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  getDocs, getDoc, setDoc, query, where, orderBy, serverTimestamp,
  Timestamp, onSnapshot, limit
} from 'firebase/firestore'
import { db } from './firebase'
import type { Organization, AppUser, Client, Category, CatalogItem, Deal, Task, Message, AgentGoal, Appointment, AppointmentRequest, OrgStats, Campaign } from '@/types'

// --- Organizations ---
export async function updateOrganization(orgId: string, data: { name?: string; plan?: Organization['plan']; settings?: Partial<Organization['settings']>; ownerId?: string }) {
  await updateDoc(doc(db, 'organizations', orgId), data)
}

export async function deleteOrganization(orgId: string) {
  await deleteDoc(doc(db, 'organizations', orgId))
}

export async function getOrgStats(orgId: string): Promise<OrgStats> {
  const [usersSnap, clientsSnap, dealsSnap, tasksSnap] = await Promise.all([
    getDocs(query(collection(db, 'users'), where('orgId', '==', orgId))),
    getDocs(collection(db, 'organizations', orgId, 'clients')),
    getDocs(collection(db, 'organizations', orgId, 'deals')),
    getDocs(collection(db, 'organizations', orgId, 'tasks')),
  ])
  return {
    users: usersSnap.size,
    clients: clientsSnap.size,
    deals: dealsSnap.size,
    tasks: tasksSnap.size,
  }
}

export async function createOrganization(data: Omit<Organization, 'id' | 'createdAt'>) {
  const ref = await addDoc(collection(db, 'organizations'), {
    ...data,
    createdAt: serverTimestamp(),
  })
  return ref.id
}

export async function getOrganization(orgId: string) {
  const snap = await getDoc(doc(db, 'organizations', orgId))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() } as Organization
}

export async function getAllOrganizations() {
  const snap = await getDocs(collection(db, 'organizations'))
  return snap.docs.map(d => ({ id: d.id, ...d.data() })) as Organization[]
}

// --- Users ---
export async function createUserProfile(uid: string, data: Omit<AppUser, 'uid' | 'createdAt'>) {
  await updateDoc(doc(db, 'users', uid), {
    ...data,
    createdAt: serverTimestamp(),
  }).catch(async () => {
    const { setDoc } = await import('firebase/firestore')
    await setDoc(doc(db, 'users', uid), { ...data, uid, createdAt: serverTimestamp() })
  })
}

export async function getUserProfile(uid: string): Promise<AppUser | null> {
  const snap = await getDoc(doc(db, 'users', uid))
  if (!snap.exists()) return null
  const data = snap.data()
  return {
    ...data,
    uid: snap.id,
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(),
  } as AppUser
}

export async function getOrgUsers(orgId: string) {
  const q = query(collection(db, 'users'), where('orgId', '==', orgId))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ ...d.data(), uid: d.id })) as AppUser[]
}

// --- Categories ---
export async function getCategories(orgId: string) {
  const q = query(collection(db, 'organizations', orgId, 'categories'), orderBy('name'))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() })) as Category[]
}

export async function createCategory(orgId: string, data: Omit<Category, 'id' | 'orgId' | 'createdAt'>) {
  const ref = await addDoc(collection(db, 'organizations', orgId, 'categories'), {
    ...data,
    orgId,
    createdAt: serverTimestamp(),
  })
  return ref.id
}

export async function updateCategory(orgId: string, categoryId: string, data: Partial<Category>) {
  await updateDoc(doc(db, 'organizations', orgId, 'categories', categoryId), data)
}

export async function deleteCategory(orgId: string, categoryId: string) {
  await deleteDoc(doc(db, 'organizations', orgId, 'categories', categoryId))
}

export async function ensureEliminadosCategory(orgId: string): Promise<string> {
  const q = query(
    collection(db, 'organizations', orgId, 'categories'),
    where('systemKey', '==', 'eliminados')
  )
  const snap = await getDocs(q)
  if (!snap.empty) return snap.docs[0].id

  const ref = await addDoc(collection(db, 'organizations', orgId, 'categories'), {
    name: 'ELIMINADOS',
    color: '#ef4444',
    description: 'Clientes eliminados automáticamente después de 14 días',
    orgId,
    isSystem: true,
    systemKey: 'eliminados',
    autoDeleteDays: 14,
    createdAt: serverTimestamp(),
  })
  return ref.id
}

// --- Outreach Campaigns (negocios de outreach creados desde el CRM) ---
// Nota: distinto de "Broadcast Campaigns" (más abajo, difusión masiva) —
// colección separada `outreach_campaigns` para no chocar con esa.
function slugify(text: string): string {
  return text
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    .slice(0, 40) || 'negocio'
}

export async function getOutreachCampaigns(orgId: string) {
  const snap = await getDocs(collection(db, 'organizations', orgId, 'outreach_campaigns'))
  return snap.docs.map(d => ({ id: d.id, ...d.data() })) as Campaign[]
}

export async function createOutreachCampaign(
  orgId: string,
  data: Omit<Campaign, 'id' | 'orgId' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  let id = slugify(data.businessLabel)
  const existing = await getDoc(doc(db, 'organizations', orgId, 'outreach_campaigns', id))
  if (existing.exists()) id = `${id}-${Date.now().toString(36)}`
  await setDoc(doc(db, 'organizations', orgId, 'outreach_campaigns', id), {
    ...data, orgId, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  })
  return id
}

export async function updateOutreachCampaign(orgId: string, campaignId: string, data: Partial<Campaign>) {
  await updateDoc(doc(db, 'organizations', orgId, 'outreach_campaigns', campaignId), {
    ...data, updatedAt: serverTimestamp(),
  })
}

export async function deleteOutreachCampaign(orgId: string, campaignId: string) {
  await deleteDoc(doc(db, 'organizations', orgId, 'outreach_campaigns', campaignId))
}

// --- Clients ---
export async function getClients(orgId: string, assignedTo?: string) {
  let q = assignedTo
    ? query(collection(db, 'organizations', orgId, 'clients'), where('assignedTo', '==', assignedTo), orderBy('createdAt', 'desc'))
    : query(collection(db, 'organizations', orgId, 'clients'), orderBy('createdAt', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() })) as Client[]
}

export function subscribeToClients(
  orgId: string,
  assignedTo: string | undefined,
  cb: (clients: Client[]) => void,
  pageSize = 100
) {
  const q = assignedTo
    ? query(collection(db, 'organizations', orgId, 'clients'), where('assignedTo', '==', assignedTo), orderBy('createdAt', 'desc'), limit(pageSize))
    : query(collection(db, 'organizations', orgId, 'clients'), orderBy('createdAt', 'desc'), limit(pageSize))
  return onSnapshot(q, snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Client[]))
}

export async function getClient(orgId: string, clientId: string) {
  const snap = await getDoc(doc(db, 'organizations', orgId, 'clients', clientId))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() } as Client
}

export async function createClient(orgId: string, data: Omit<Client, 'id' | 'orgId' | 'createdAt' | 'updatedAt'>) {
  const ref = await addDoc(collection(db, 'organizations', orgId, 'clients'), {
    ...data,
    orgId,
    photos: data.photos || [],
    tags: data.tags || [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

export async function updateClient(orgId: string, clientId: string, data: Partial<Client>) {
  await updateDoc(doc(db, 'organizations', orgId, 'clients', clientId), {
    ...data,
    updatedAt: serverTimestamp(),
  })
}

export async function deleteClient(orgId: string, clientId: string) {
  await deleteDoc(doc(db, 'organizations', orgId, 'clients', clientId))
}

// --- Catalog ---
export async function getCatalog(orgId: string) {
  const q = query(collection(db, 'organizations', orgId, 'catalog'), orderBy('createdAt', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() })) as CatalogItem[]
}

export async function createCatalogItem(orgId: string, data: Omit<CatalogItem, 'id' | 'orgId' | 'createdAt'>) {
  const payload: Record<string, unknown> = {
    orgId,
    title: data.title,
    available: data.available,
    photos: data.photos || [],
    specs: data.specs || {},
    createdAt: serverTimestamp(),
  }
  if (data.description !== undefined) payload.description = data.description
  if (data.price !== undefined) payload.price = data.price
  const ref = await addDoc(collection(db, 'organizations', orgId, 'catalog'), payload)
  return ref.id
}

export async function updateCatalogItem(orgId: string, itemId: string, data: Partial<CatalogItem>) {
  const clean = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined))
  await updateDoc(doc(db, 'organizations', orgId, 'catalog', itemId), clean)
}

export async function deleteCatalogItem(orgId: string, itemId: string) {
  await deleteDoc(doc(db, 'organizations', orgId, 'catalog', itemId))
}

// --- Deals ---
export async function getDeals(orgId: string) {
  const q = query(collection(db, 'organizations', orgId, 'deals'), orderBy('updatedAt', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() })) as Deal[]
}

export async function createDeal(orgId: string, data: Omit<Deal, 'id' | 'orgId' | 'createdAt' | 'updatedAt'>) {
  const ref = await addDoc(collection(db, 'organizations', orgId, 'deals'), {
    ...data,
    orgId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

export async function updateDeal(orgId: string, dealId: string, data: Partial<Deal>) {
  await updateDoc(doc(db, 'organizations', orgId, 'deals', dealId), {
    ...data,
    updatedAt: serverTimestamp(),
  })
}

export async function deleteDeal(orgId: string, dealId: string) {
  await deleteDoc(doc(db, 'organizations', orgId, 'deals', dealId))
}

export async function updateUserRole(uid: string, role: string) {
  await updateDoc(doc(db, 'users', uid), { role })
}

export async function removeUserFromOrg(uid: string) {
  await updateDoc(doc(db, 'users', uid), { orgId: null })
}

// --- Tasks ---
export async function getTasks(orgId: string, assignedTo?: string) {
  const q = assignedTo
    ? query(collection(db, 'organizations', orgId, 'tasks'), where('assignedTo', '==', assignedTo), orderBy('createdAt', 'desc'))
    : query(collection(db, 'organizations', orgId, 'tasks'), orderBy('createdAt', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() })) as Task[]
}

export async function createTask(orgId: string, data: Omit<Task, 'id' | 'orgId' | 'createdAt'>) {
  const ref = await addDoc(collection(db, 'organizations', orgId, 'tasks'), {
    ...data,
    orgId,
    createdAt: serverTimestamp(),
  })
  return ref.id
}

export async function updateTask(orgId: string, taskId: string, data: Partial<Task>) {
  await updateDoc(doc(db, 'organizations', orgId, 'tasks', taskId), data)
}

export async function deleteTask(orgId: string, taskId: string) {
  await deleteDoc(doc(db, 'organizations', orgId, 'tasks', taskId))
}

// --- Messages (Chat) ---
export async function sendMessage(
  orgId: string,
  clientId: string,
  data: Omit<Message, 'id' | 'orgId' | 'clientId' | 'createdAt'>
) {
  const raw = { ...data, orgId, clientId, photos: data.photos || [], createdAt: serverTimestamp() }
  const payload = Object.fromEntries(Object.entries(raw).filter(([, v]) => v !== undefined))
  const ref = await addDoc(
    collection(db, 'organizations', orgId, 'clients', clientId, 'messages'),
    payload
  )
  // Actualizar cliente con timestamp del último mensaje para reordenamiento en tiempo real
  const lastMessage = data.isNote ? undefined : (
    data.text ||
    (data.type === 'image' ? '📷 Imagen' :
     data.type === 'audio' ? '🎤 Audio' :
     data.type === 'video' ? '🎬 Video' : '📎 Archivo')
  )
  if (!data.isNote) {
    await updateDoc(doc(db, 'organizations', orgId, 'clients', clientId), {
      lastMessageAt: serverTimestamp(),
      lastMessage,
      updatedAt: serverTimestamp(),
    })
  }
  return ref.id
}

export function subscribeToMessages(
  orgId: string,
  clientId: string,
  callback: (msgs: Message[]) => void,
  onError?: (error: Error) => void
) {
  const q = query(
    collection(db, 'organizations', orgId, 'clients', clientId, 'messages'),
    orderBy('createdAt', 'asc')
  )
  return onSnapshot(
    q,
    snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Message[]),
    (error) => {
      console.error('[Chat] Error en listener de mensajes:', error.code, error.message)
      onError?.(error)
    }
  )
}

// --- WhatsApp config (lookup por phoneNumberId) ---
export async function saveWhatsAppConfig(
  phoneNumberId: string,
  orgId: string,
  token: string
) {
  await setDoc(doc(db, 'whatsapp_configs', phoneNumberId), { orgId, token })
}

export async function getClientsByCategory(orgId: string, categoryId: string): Promise<Client[]> {
  const q = query(
    collection(db, 'organizations', orgId, 'clients'),
    where('categoryId', '==', categoryId)
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() })) as Client[]
}

// --- WhatsApp Templates ---
import type { WhatsAppTemplate } from '@/types'

export async function getWhatsAppTemplates(orgId: string): Promise<WhatsAppTemplate[]> {
  const q = query(
    collection(db, 'organizations', orgId, 'whatsapp_templates'),
    orderBy('createdAt', 'desc')
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() })) as WhatsAppTemplate[]
}

export async function createWhatsAppTemplate(orgId: string, data: { name: string; body: string }) {
  await addDoc(collection(db, 'organizations', orgId, 'whatsapp_templates'), {
    ...data,
    createdAt: serverTimestamp(),
  })
}

export async function deleteWhatsAppTemplate(orgId: string, templateId: string) {
  await deleteDoc(doc(db, 'organizations', orgId, 'whatsapp_templates', templateId))
}

export async function getClientByPhone(orgId: string, phone: string): Promise<Client | null> {
  const q = query(
    collection(db, 'organizations', orgId, 'clients'),
    where('whatsappPhone', '==', phone)
  )
  const snap = await getDocs(q)
  if (snap.empty) return null
  const d = snap.docs[0]
  return { id: d.id, ...d.data() } as Client
}

// --- Agent Goals ---
export async function getAgentGoal(orgId: string, uid: string, month: string): Promise<AgentGoal | null> {
  const snap = await getDoc(doc(db, 'organizations', orgId, 'goals', `${uid}_${month}`))
  if (!snap.exists()) return null
  return { ...snap.data() } as AgentGoal
}

export async function setAgentGoal(orgId: string, uid: string, month: string, data: Partial<AgentGoal>) {
  await setDoc(doc(db, 'organizations', orgId, 'goals', `${uid}_${month}`), {
    uid,
    orgId,
    month,
    messagesGoal: data.messagesGoal ?? 0,
    clientsGoal: data.clientsGoal ?? 0,
    dealsGoal: data.dealsGoal ?? 0,
    revenueGoal: data.revenueGoal ?? 0,
    updatedAt: serverTimestamp(),
  })
}

export async function getAllGoalsForMonth(orgId: string, month: string): Promise<AgentGoal[]> {
  const q = query(
    collection(db, 'organizations', orgId, 'goals'),
    where('month', '==', month)
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => d.data()) as AgentGoal[]
}

// --- Appointments ---
export async function getAppointments(orgId: string, assignedTo?: string): Promise<Appointment[]> {
  const q = assignedTo
    ? query(collection(db, 'organizations', orgId, 'appointments'), where('assignedTo', '==', assignedTo), orderBy('startDate', 'asc'))
    : query(collection(db, 'organizations', orgId, 'appointments'), orderBy('startDate', 'asc'))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() })) as Appointment[]
}

export async function createAppointment(orgId: string, data: Omit<Appointment, 'id' | 'orgId' | 'createdAt'>) {
  // Remove undefined values to avoid Firestore errors
  const clean: Record<string, unknown> = { orgId, createdAt: serverTimestamp() }
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined) clean[k] = v
  }
  const ref = await addDoc(collection(db, 'organizations', orgId, 'appointments'), clean)
  return ref.id
}

export async function updateAppointment(orgId: string, appointmentId: string, data: Partial<Appointment>) {
  await updateDoc(doc(db, 'organizations', orgId, 'appointments', appointmentId), data)
}

export async function deleteAppointment(orgId: string, appointmentId: string) {
  await deleteDoc(doc(db, 'organizations', orgId, 'appointments', appointmentId))
}

// --- Appointment Requests ---
export async function getAppointmentRequests(orgId: string, status?: 'pending' | 'confirmed' | 'rejected'): Promise<AppointmentRequest[]> {
  const q = status
    ? query(collection(db, 'organizations', orgId, 'appointment_requests'), where('status', '==', status), orderBy('createdAt', 'desc'))
    : query(collection(db, 'organizations', orgId, 'appointment_requests'), orderBy('createdAt', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() })) as AppointmentRequest[]
}

export async function createAppointmentRequest(orgId: string, data: Omit<AppointmentRequest, 'id' | 'orgId' | 'createdAt'>) {
  const ref = await addDoc(collection(db, 'organizations', orgId, 'appointment_requests'), {
    orgId,
    ...data,
    createdAt: serverTimestamp(),
  })
  return ref.id
}

export async function updateAppointmentRequest(orgId: string, requestId: string, data: Partial<Pick<AppointmentRequest, 'status'>>) {
  await updateDoc(doc(db, 'organizations', orgId, 'appointment_requests', requestId), data)
}

// --- Broadcast Campaigns ---
import type { BroadcastCampaign, Webhook, WebhookEvent, CaptureForm, ActivityLog, EmailThread } from '@/types'

export async function getCampaigns(orgId: string): Promise<BroadcastCampaign[]> {
  const q = query(collection(db, 'organizations', orgId, 'campaigns'), orderBy('createdAt', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() })) as BroadcastCampaign[]
}

export async function createCampaign(orgId: string, data: Omit<BroadcastCampaign, 'id' | 'orgId' | 'createdAt'>): Promise<string> {
  const ref = await addDoc(collection(db, 'organizations', orgId, 'campaigns'), {
    ...data, orgId, createdAt: serverTimestamp(),
  })
  return ref.id
}

export async function updateCampaign(orgId: string, id: string, data: Partial<BroadcastCampaign>) {
  await updateDoc(doc(db, 'organizations', orgId, 'campaigns', id), data)
}

// --- Webhooks ---
export async function getWebhooks(orgId: string): Promise<Webhook[]> {
  const q = query(collection(db, 'organizations', orgId, 'webhooks'), orderBy('createdAt', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() })) as Webhook[]
}

export async function createWebhook(orgId: string, data: Omit<Webhook, 'id' | 'orgId' | 'createdAt'>): Promise<string> {
  const ref = await addDoc(collection(db, 'organizations', orgId, 'webhooks'), {
    ...data, orgId, createdAt: serverTimestamp(),
  })
  return ref.id
}

export async function updateWebhook(orgId: string, id: string, data: Partial<Webhook>) {
  await updateDoc(doc(db, 'organizations', orgId, 'webhooks', id), data)
}

export async function deleteWebhook(orgId: string, id: string) {
  await deleteDoc(doc(db, 'organizations', orgId, 'webhooks', id))
}

// --- Capture Forms ---
export async function getCaptureForms(orgId: string): Promise<CaptureForm[]> {
  const q = query(collection(db, 'organizations', orgId, 'forms'), orderBy('createdAt', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() })) as CaptureForm[]
}

export async function createCaptureForm(orgId: string, data: Omit<CaptureForm, 'id' | 'orgId' | 'createdAt' | 'submissionCount'>): Promise<string> {
  const ref = await addDoc(collection(db, 'organizations', orgId, 'forms'), {
    ...data, orgId, submissionCount: 0, createdAt: serverTimestamp(),
  })
  return ref.id
}

export async function updateCaptureForm(orgId: string, id: string, data: Partial<CaptureForm>) {
  await updateDoc(doc(db, 'organizations', orgId, 'forms', id), data)
}

export async function deleteCaptureForm(orgId: string, id: string) {
  await deleteDoc(doc(db, 'organizations', orgId, 'forms', id))
}

export async function getCaptureFormPublic(orgId: string, formId: string): Promise<CaptureForm | null> {
  const snap = await getDoc(doc(db, 'organizations', orgId, 'forms', formId))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() } as CaptureForm
}

// --- Activity Log ---
export async function logActivity(orgId: string, data: Omit<ActivityLog, 'id' | 'orgId' | 'createdAt'>) {
  await addDoc(collection(db, 'organizations', orgId, 'activity_log'), {
    ...data, orgId, createdAt: serverTimestamp(),
  })
}

export async function getActivityLog(orgId: string, limit_ = 100): Promise<ActivityLog[]> {
  const q = query(collection(db, 'organizations', orgId, 'activity_log'), orderBy('createdAt', 'desc'), limit(limit_))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() })) as ActivityLog[]
}

// --- Email threads ---
export async function getEmailThreads(orgId: string, clientId: string): Promise<EmailThread[]> {
  const q = query(
    collection(db, 'organizations', orgId, 'clients', clientId, 'emails'),
    orderBy('createdAt', 'desc')
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() })) as EmailThread[]
}

export async function saveEmailThread(orgId: string, clientId: string, data: Omit<EmailThread, 'id' | 'orgId' | 'clientId' | 'createdAt'>) {
  await addDoc(collection(db, 'organizations', orgId, 'clients', clientId, 'emails'), {
    ...data, orgId, clientId, createdAt: serverTimestamp(),
  })
}

export async function getAgentStats(orgId: string, uid: string, month: string): Promise<{ messagesSent: number; clientsHandled: number; dealsClosed: number; revenue: number }> {
  // Clients assigned
  const clientsQ = query(
    collection(db, 'organizations', orgId, 'clients'),
    where('assignedTo', '==', uid)
  )
  const clientsSnap = await getDocs(clientsQ)
  const clientsHandled = clientsSnap.size

  // Deals closed this month
  const dealsQ = query(
    collection(db, 'organizations', orgId, 'deals'),
    where('assignedTo', '==', uid),
    where('stage', '==', 'closed')
  )
  const dealsSnap = await getDocs(dealsQ)
  const dealsClosed = dealsSnap.size
  const revenue = dealsSnap.docs.reduce((sum, d) => sum + (d.data().value || 0), 0)

  return { messagesSent: 0, clientsHandled, dealsClosed, revenue }
}
