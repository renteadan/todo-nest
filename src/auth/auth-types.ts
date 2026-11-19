export interface AuthUser {
  id: number;
  email: string;
  name: string | null;
}

declare module '@nestjs/authentication' {
  interface AuthenticationTypes {
    user: AuthUser;
    refreshTokens: false;
  }
}
