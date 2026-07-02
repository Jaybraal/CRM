export interface SubscriptionStatus {
  uid: string;
  status: 'trial' | 'active' | 'canceled';
  customerId: string;
  trialStartedAt: number; // Unix timestamp
  trialEndsAt: number; // Unix timestamp (30 min from start)
  subscriptionId?: string;
  currentPeriodEnd?: number;
  canceledAt?: number;
}

export interface StripeCheckoutResponse {
  sessionUrl: string;
}
