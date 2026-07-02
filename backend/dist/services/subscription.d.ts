import { SubscriptionStatus } from '../types/subscription';
export declare const SubscriptionService: {
    createTrialUser(uid: string, email: string): Promise<SubscriptionStatus>;
    getSubscriptionStatus(uid: string): Promise<SubscriptionStatus | null>;
    updateFromStripeWebhook(customerId: string, event: any): Promise<void>;
    isTrialActive(uid: string): Promise<boolean>;
    isPaid(uid: string): Promise<boolean>;
    canWrite(uid: string): Promise<boolean>;
    getWebhookSecret(): string;
};
//# sourceMappingURL=subscription.d.ts.map