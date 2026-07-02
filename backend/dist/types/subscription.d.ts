export interface SubscriptionStatus {
    uid: string;
    status: 'trial' | 'active' | 'canceled';
    customerId: string;
    trialStartedAt: number;
    trialEndsAt: number;
    subscriptionId?: string;
    currentPeriodEnd?: number;
    canceledAt?: number;
}
export interface StripeCheckoutResponse {
    sessionUrl: string;
}
//# sourceMappingURL=subscription.d.ts.map