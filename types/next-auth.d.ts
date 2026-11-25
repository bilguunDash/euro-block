import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role?: string;
      isApproved?: boolean;
      stationCode?: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    role?: string;
    isApproved?: boolean;
    stationCode?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: string;
    isApproved?: boolean;
    stationCode?: string | null;
  }
}

