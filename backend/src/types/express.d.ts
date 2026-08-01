import { AdminRole } from "../generated/prisma/client/index.js";

declare global {
  namespace Express {
    interface Request {
      id?: string;
      rawBody?: Buffer;
      admin?: {
        id: number;
        email: string;
        role: AdminRole;
      };
    }
  }
}
