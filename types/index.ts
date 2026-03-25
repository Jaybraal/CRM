export type UserRole = 'super_admin' | 'owner' | 'manager' | 'agent'

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

export interface Organization {
  id: string
  name: string
  ownerId: string
  plan: 'trial' | 'basic' | 'pro'
  createdAt: Date
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
    roundRobinIndex?: number
  }
}

export interface WhatsAppTemplate {
  id: string
  name: string
  body: string
  createdAt: Date
}

export type MessageType = 'text' | 'image' | 'location' | 'call'

export interface MessageLocation {
  lat: number
  lng: number
  name?: string
}

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

export interface Client {
  id: string
  orgId: string
  assignedTo: string
  name: string
  email?: string
  phone?: string
  whatsappPhone?: string
  whatsappJid?: string
  categoryId?: string
  tags: string[]
  photos: string[]
  notes?: string
  status: 'lead' | 'prospect' | 'active' | 'inactive'
  pipelineStage?: string
  movedToCategoryAt?: Date
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
