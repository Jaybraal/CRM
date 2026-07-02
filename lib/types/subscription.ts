export interface SubscriptionStatus {
  uid: string
  status: 'trial' | 'active' | 'canceled'
  trialStartedAt: number
  trialEndsAt: number
  customerId: string
  subscriptionId?: string
  currentPeriodEnd?: number
  canceledAt?: number
}
