export type UserRole = 'super_admin' | 'owner' | 'manager' | 'agent'

export interface AppUser {
  uid: string
  email: string
  displayName: string
  role: UserRole
  orgId: string | null
  createdAt: Date
  photoURL?: string
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
  }
}

export interface WhatsAppTemplate {
  id: string
  name: string
  body: string
  createdAt: Date
}

export interface Message {
  id: string
  orgId: string
  clientId: string
  text?: string
  photos: string[]
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
}

export interface Client {
  id: string
  orgId: string
  assignedTo: string
  name: string
  email?: string
  phone?: string
  whatsappPhone?: string
  categoryId?: string
  tags: string[]
  photos: string[]
  notes?: string
  status: 'lead' | 'prospect' | 'active' | 'inactive'
  pipelineStage?: string
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
