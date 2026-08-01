import { Router } from "express";
import {
  approveAccessRequest,
  deleteAccessRequest,
  getAccessRequestById,
  listAccessRequests,
  rejectAccessRequest,
  submitAccessRequest,
  withdrawAccessRequest,
} from "../controllers/accessRequest.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { AdminRole } from "../generated/prisma/client.js";
import {
  accessRequestEmailRateLimiter,
  accessRequestIpRateLimiter,
} from "../middleware/rateLimiter.js";

export const router = Router();

router.post("/", accessRequestIpRateLimiter(), accessRequestEmailRateLimiter(), submitAccessRequest);

router.use(authenticate, authorize(AdminRole.SUPER_ADMIN));

router.get("/", listAccessRequests);
router.get("/:id", getAccessRequestById);
router.post("/:id/approve", approveAccessRequest);
router.post("/:id/reject", rejectAccessRequest);
router.post("/:id/withdraw", withdrawAccessRequest);
router.delete("/:id", deleteAccessRequest);
