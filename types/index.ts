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
  callDuration?: number // seconds, -1 = missed
  senderId: string
  senderName: string
  source: 'internal' | 'whatsapp'
  status?: MessageStatus   // solo mensajes enviados por el agente
  whatsappMsgId?: string   // ID del mensaje en Baileys
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
  notes?: string
  assignedTo: string
  createdAt: Date
  updatedAt: Date
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
