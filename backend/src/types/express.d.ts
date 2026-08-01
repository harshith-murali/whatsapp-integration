import { AdminRole } from "../generated/prisma/client/index.js";

declare global {
  namespace Express {
    interface Request {
      admin?: {
        id: number;
        email: string;
        role: AdminRole;
      };
    }
  }
}
