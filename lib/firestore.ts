import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  getDocs, getDoc, setDoc, query, where, orderBy, serverTimestamp,
  Timestamp, onSnapshot
} from 'firebase/firestore'
import { db } from './firebase'
import type { Organization, AppUser, Client, Category, CatalogItem, Deal, Task, Message, AgentGoal, Appointment, OrgStats } from '@/types'

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

// --- Clients ---
export async function getClients(orgId: string, assignedTo?: string) {
  let q = assignedTo
    ? query(collection(db, 'organizations', orgId, 'clients'), where('assignedTo', '==', assignedTo), orderBy('createdAt', 'desc'))
    : query(collection(db, 'organizations', orgId, 'clients'), orderBy('createdAt', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() })) as Client[]
}

export function subscribeToClients(orgId: string, assignedTo: string | undefined, cb: (clients: Client[]) => void) {
  const q = assignedTo
    ? query(collection(db, 'organizations', orgId, 'clients'), where('assignedTo', '==', assignedTo), orderBy('createdAt', 'desc'))
    : query(collection(db, 'organizations', orgId, 'clients'), orderBy('createdAt', 'desc'))
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
  const ref = await addDoc(collection(db, 'organizations', orgId, 'catalog'), {
    ...data,
    orgId,
    photos: data.photos || [],
    specs: data.specs || {},
    createdAt: serverTimestamp(),
  })
  return ref.id
}

export async function updateCatalogItem(orgId: string, itemId: string, data: Partial<CatalogItem>) {
  await updateDoc(doc(db, 'organizations', orgId, 'catalog', itemId), data)
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
  const ref = await addDoc(
    collection(db, 'organizations', orgId, 'clients', clientId, 'messages'),
    { ...data, orgId, clientId, photos: data.photos || [], createdAt: serverTimestamp() }
  )
  return ref.id
}

export function subscribeToMessages(
  orgId: string,
  clientId: string,
  callback: (msgs: Message[]) => void
) {
  const q = query(
    collection(db, 'organizations', orgId, 'clients', clientId, 'messages'),
    orderBy('createdAt', 'asc')
  )
  return onSnapshot(q, snap =>
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Message[])
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
  const ref = await addDoc(collection(db, 'organizations', orgId, 'appointments'), {
    ...data,
    orgId,
    createdAt: serverTimestamp(),
  })
  return ref.id
}

export async function updateAppointment(orgId: string, appointmentId: string, data: Partial<Appointment>) {
  await updateDoc(doc(db, 'organizations', orgId, 'appointments', appointmentId), data)
}

export async function deleteAppointment(orgId: string, appointmentId: string) {
  await deleteDoc(doc(db, 'organizations', orgId, 'appointments', appointmentId))
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
