export declare const StripeService: {
    createCustomer(email: string, uid: string): Promise<{
        customerId: string;
    }>;
    createCheckoutSession(customerId: string, returnUrl: string): Promise<{
        sessionUrl: string | null;
    }>;
    getSubscriptionStatus(customerId: string): Promise<{
        status: string;
        trialEndsAt: number;
        subscriptionId?: undefined;
        periodEnd?: undefined;
    } | {
        status: "active" | "trialing" | "canceled";
        subscriptionId: string;
        periodEnd: any;
        trialEndsAt?: undefined;
    }>;
    getWebhookSecret(): string;
};
//# sourceMappingURL=stripe.d.ts.map