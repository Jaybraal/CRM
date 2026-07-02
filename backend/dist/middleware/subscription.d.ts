import { Request, Response, NextFunction } from 'express';
declare global {
    namespace Express {
        interface Request {
            uid?: string;
        }
    }
}
export declare const requireSubscription: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
//# sourceMappingURL=subscription.d.ts.map