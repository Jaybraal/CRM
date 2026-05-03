export type UserRole = 'super_admin' | 'owner' | 'manager' | 'supervisor' | 'agent'

export interface AppUser {
  uid: string
  email: string
  displayName: string
  role: UserRole
  orgId: string | null
  createdAt: Date
  photoURL?: string
  whatsappPhone?: string     // agent's assigned WA number (optional)
  whatsappSessionId?: string // session ID in Baileys (defaults to uid)
}

export type QualificationQuestionType = 'text' | 'phone' | 'yes_no' | 'number'

export interface QualificationQuestion {
  id: string
  text: string
  type: QualificationQuestionType
  order: number
  autoTag?: boolean  // si true, la respuesta se añade como etiqueta al cliente
}

export interface Organization {
  id: string
  name: string
  ownerId: string
  plan: 'trial' | 'basic' | 'pro'
  createdAt: Date
  accessExpiresAt?: Date | null
  settings: {
    catalogEnabled: boolean
    industry: string
    whatsapp?: {
      phoneNumberId: string
      token: string
    }
    pipelineStages?: PipelineStage[]
    autoReply?: {
      enabled: boolean
      message: string
    }
    qualificationForm?: {
      enabled: boolean
      questions: QualificationQuestion[]
      completionMessage?: string
    }
    roundRobinIndex?: number
    clientStatuses?: ClientStatus[]
    whatsappMetaConfigured?: boolean
    whatsappNumber?: string    // número del negocio para catálogo público (ej: 5491112345678)
    windowMessage?: {
      enabled: boolean
      message: string
      delayHours: number  // horas desde el primer mensaje del cliente
    }
    businessHours?: {
      days: number[]       // 0=Dom, 1=Lun, 2=Mar, 3=Mié, 4=Jue, 5=Vie, 6=Sáb
      openTime: string     // "08:00"
      closeTime: string    // "18:00"
      slotMinutes: number  // 30 | 60
    }
    websiteUrl?: string    // URL del sitio web vinculado (ej: https://musaweb.up.railway.app)
  }
}

export interface WhatsAppTemplate {
  id: string
  name: string
  body: string
  createdAt: Date
}

export type MessageType = 'text' | 'image' | 'video' | 'audio' | 'location' | 'call' | 'document'

export interface MessageLocation {
  lat: number
  lng: number
  name?: string
}

export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read'

export interface Message {
  id: string
  orgId: string
  clientId: string
  type?: MessageType
  text?: string
  photos: string[]
  location?: MessageLocation
  callDuration?: number    // seconds, -1 = missed
  audioDuration?: number   // seconds — nota de voz grabada desde el CRM
  senderId: string
  senderName: string
  source: 'internal' | 'whatsapp' | 'instagram'
  status?: MessageStatus   // solo mensajes enviados por el agente
  whatsappMsgId?: string   // ID del mensaje en Baileys
  instagramMsgId?: string  // ID del mensaje en Instagram
  isNote?: boolean         // nota interna, no se envía por WA
  replyTo?: {
    id: string
    text?: string
    senderName: string
    type?: MessageType
  }
  createdAt: Date
}

export interface Category {
  id: string
  name: string
  color: string
  description?: string
  orgId: string
  createdAt: Date
  isSystem?: boolean
  systemKey?: string
  autoDeleteDays?: number
}

export interface ClientStatus {
  value: string
  label: string
}

export const DEFAULT_CLIENT_STATUSES: ClientStatus[] = [
  { value: 'lead', label: 'Lead' },
  { value: 'prospect', label: 'Prospecto' },
  { value: 'active', label: 'Activo' },
  { value: 'inactive', label: 'Inactivo' },
]

export interface Client {
  id: string
  orgId: string
  assignedTo: string
  name: string
  email?: string
  phone?: string
  whatsappPhone?: string
  whatsappJid?: string
  isLid?: boolean
  instagramId?: string     // Instagram user ID (IGSID)
  categoryId?: string
  tags: string[]
  photos: string[]
  notes?: string
  status: string
  pipelineStage?: string
  movedToCategoryAt?: Date
  lastMessageAt?: Date
  lastMessage?: string
  unreadCount?: number
  createdAt: Date
  updatedAt: Date
  createdBy: string
}

export interface CatalogItem {
  id: string
  orgId: string
  title: string
  description?: string
  price?: number
  photos: string[]
  specs: Record<string, string>
  available: boolean
  createdAt: Date
}

export interface PipelineStage {
  id: string
  name: string
  order: number
  color: string
}

export interface Deal {
  id: string
  orgId: string
  clientId: string
  catalogItemId?: string
  stage: string
  value?: number
  probability?: number   // 0-100
  closeDate?: Date       // fecha estimada de cierre
  notes?: string
  assignedTo: string
  createdAt: Date
  updatedAt: Date
}

export interface BroadcastCampaign {
  id: string
  orgId: string
  name: string
  message: string
  status: 'scheduled' | 'sending' | 'done' | 'failed'
  recipientCount: number
  sentCount: number
  failedCount: number
  scheduledAt?: Date
  sentAt?: Date
  createdAt: Date
  createdBy: string
  filterStatus?: string
  filterCategory?: string
}

export type WebhookEvent = 'new_client' | 'new_message' | 'deal_closed' | 'deal_created' | 'task_created'

export interface Webhook {
  id: string
  orgId: string
  url: string
  events: WebhookEvent[]
  active: boolean
  createdAt: Date
  secret?: string
}

export interface CaptureForm {
  id: string
  orgId: string
  name: string
  fields: CaptureFormField[]
  assignTo?: string       // uid del agente al que se asignan los leads
  defaultStatus: string
  defaultCategory?: string
  confirmationMessage: string
  active: boolean
  createdAt: Date
  submissionCount: number
}

export interface CaptureFormField {
  id: string
  label: string
  type: 'text' | 'email' | 'phone' | 'textarea' | 'select'
  options?: string[]      // para tipo select
  required: boolean
  mapTo?: 'name' | 'email' | 'phone' | 'whatsappPhone' | 'notes' // campo del cliente
}

export interface ActivityLog {
  id: string
  orgId: string
  entityType: 'client' | 'deal' | 'task'
  entityId: string
  action: string          // 'created' | 'updated' | 'deleted' | 'stage_changed' | 'assigned' | ...
  detail?: string
  actorId: string
  actorName: string
  createdAt: Date
}

export interface Task {
  id: string
  orgId: string
  title: string
  description?: string
  assignedTo: string
  clientId?: string
  dueDate?: Date
  completed: boolean
  createdAt: Date
}

export interface AgentGoal {
  uid: string
  orgId: string
  month: string // 'YYYY-MM'
  messagesGoal: number
  clientsGoal: number
  dealsGoal: number
  revenueGoal: number
  updatedAt: Date
}

export interface AgentStats {
  uid: string
  displayName: string
  email: string
  messagesSent: number
  clientsHandled: number
  dealsClosed: number
  revenue: number
}

export interface Appointment {
  id: string
  orgId: string
  title: string
  description?: string
  clientId?: string
  clientName?: string
  assignedTo: string
  assignedToName?: string
  startDate: Date
  endDate?: Date
  createdAt: Date
}

export interface OrgStats {
  users: number
  clients: number
  deals: number
  tasks: number
}

export interface EmailThread {
  id: string
  orgId: string
  clientId: string
  subject: string
  fromName: string
  fromEmail: string
  toEmail: string
  body: string
  direction: 'inbound' | 'outbound'
  createdAt: Date
}
