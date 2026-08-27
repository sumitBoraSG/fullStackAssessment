import { UserRole } from "@database/enum/userRole";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        role: UserRole;
      };
    }
  }
}

export {};