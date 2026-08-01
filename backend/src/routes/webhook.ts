import { Router } from "express";
import { receiveWhatsAppWebhook, verifyWhatsAppWebhook } from "../controllers/webhook.js";

export const router = Router();

router.get("/whatsapp", verifyWhatsAppWebhook);
router.post("/whatsapp", receiveWhatsAppWebhook);
