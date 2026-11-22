import { type Role } from '../generated/prisma/enums.js';

export interface AuthUser {
  id: number;
  email: string;
  name: string | null;
  role: Role;
}

declare module '@nestjs/authentication' {
  interface AuthenticationTypes {
    user: AuthUser;
  }
}
