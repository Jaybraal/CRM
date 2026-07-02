"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const admin = __importStar(require("firebase-admin"));
const webhook_1 = __importDefault(require("./routes/webhook"));
const whatsapp_1 = require("./services/whatsapp");
const app = (0, express_1.default)();
// CRITICAL: Stripe raw body middleware BEFORE JSON parsing
app.use('/api/webhook/stripe', express_1.default.raw({ type: 'application/json' }));
// JSON parsing for all other routes
app.use(express_1.default.json());
// Initialize Firebase Admin
admin.initializeApp();
// Routes
app.use('/api/webhook', webhook_1.default);
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`[CRM] Server corriendo en puerto ${PORT}`);
});
// Initialize WhatsApp on startup
(async () => {
    try {
        await (0, whatsapp_1.initWhatsApp)();
        console.log('[CRM] WhatsApp inicializado');
    }
    catch (err) {
        console.warn('[CRM] WhatsApp: ', err instanceof Error ? err.message : err);
    }
})();
//# sourceMappingURL=index.js.map