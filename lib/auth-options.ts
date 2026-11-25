import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "./prisma";
import bcrypt from "bcryptjs";

const normalizeEmail = (v: unknown) => String(v || "").trim().toLowerCase();

// DB хэвийн үед эрхийн өөрчлөлтийг дараагийн хүсэлтээр, 60 секундийн дотор мөрдүүлнэ.
const SESSION_REVALIDATE_MS = 60_000;
const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

type UserSnapshot = {
  role: string;
  isApproved: boolean;
  stationCode: string | null;
  tabletAccessAllowed: boolean;
  mobileAccessAllowed: boolean;
  sortDualRole: boolean;
};
type SnapshotEntry = { at: number; snapshot: UserSnapshot | null };

// Route handler-ийн getServerSession шинэ token-ийг cookie-д хадгалдаггүй.
// Хуучин cookie-той давтан/зэрэгцээ хүсэлтүүдийг нэг DB уншилтаар үйлчилнэ.
const snapshotCache = new Map<string, SnapshotEntry>();
const snapshotLoads = new Map<string, Promise<SnapshotEntry>>();

async function loadUserSnapshot(userId: string): Promise<SnapshotEntry> {
  const now = Date.now();
  const cached = snapshotCache.get(userId);
  if (cached && now >= cached.at && now - cached.at < SESSION_REVALIDATE_MS) return cached;

  const pending = snapshotLoads.get(userId);
  if (pending) return pending;

  const load = (async () => {
    const snapshot = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        role: true,
        isApproved: true,
        stationCode: true,
        tabletAccessAllowed: true,
        mobileAccessAllowed: true,
        sortDualRole: true,
      },
    });
    // Уншилт эхэлсэн цагийг хадгалж, удаан query шалгах хугацааг сунгахгүй.
    const entry: SnapshotEntry = { at: now, snapshot };
    if (snapshotCache.size >= 500) {
      for (const [key, value] of snapshotCache) {
        if (now - value.at >= SESSION_REVALIDATE_MS) snapshotCache.delete(key);
      }
      // Хугацаа дуусаагүй олон хэрэглэгч байсан ч кэш хязгааргүй өсөхгүй.
      const oldest = snapshotCache.keys().next().value;
      if (snapshotCache.size >= 500 && oldest !== undefined) snapshotCache.delete(oldest);
    }
    snapshotCache.set(userId, entry);
    return entry;
  })();
  snapshotLoads.set(userId, load);
  try {
    return await load;
  } finally {
    snapshotLoads.delete(userId);
  }
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as any,
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = normalizeEmail(credentials?.email);
        const password = String(credentials?.password || "");
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return null;
        if (user.isApproved === false) {
          throw new Error("ACCOUNT_NOT_APPROVED");
        }
        if (!user.passwordHash) {
          throw new Error("PASSWORD_NOT_SET");
        }

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          stationCode: user.stationCode,
          isApproved: user.isApproved,
          tabletAccessAllowed: user.tabletAccessAllowed,
          mobileAccessAllowed: user.mobileAccessAllowed,
          sortDualRole: user.sortDualRole,
        } as any;
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: SESSION_MAX_AGE_SECONDS,
  },
  // NextAuth 4-д нэвтрэх үеийн JWT maxAge-г session-оос тусад нь тохируулна.
  jwt: {
    maxAge: SESSION_MAX_AGE_SECONDS,
  },
  callbacks: {
    async jwt({ token, user }) {
      // authorize() нэвтрэх үед DB болон isApproved-ийг аль хэдийн шалгасан.
      if (user) {
        token.id = user.id;
        token.role = (user as any).role ?? "operator";
        token.isApproved = (user as any).isApproved ?? true;
        token.stationCode = (user as any).stationCode;
        token.tabletAccessAllowed = (user as any).tabletAccessAllowed ?? true;
        token.mobileAccessAllowed = (user as any).mobileAccessAllowed ?? false;
        token.sortDualRole = (user as any).sortDualRole ?? false;
        token.revalidatedAt = Date.now();
        return token;
      }

      // NextAuth 4 энэ алдааг барьж session-ийг хоослоод cookie-г цэвэрлэнэ.
      if (token.isApproved === false) throw new Error("SESSION_REVOKED_NOT_APPROVED");
      const userId = String(token.id || token.sub || "");
      if (!userId) throw new Error("SESSION_REVOKED_NO_USER_ID");

      const age = Date.now() - Number(token.revalidatedAt);
      if (Number.isFinite(age) && age >= 0 && age < SESSION_REVALIDATE_MS) return token;

      let entry: SnapshotEntry;
      try {
        entry = await loadUserSnapshot(userId);
      } catch (error) {
        // DB түр тасарвал ээлжийн хэрэглэгчийг гаргахгүй; хугацааг шинэчлэхгүй
        // тул дараагийн хүсэлт DB-ээс дахин шалгана.
        console.error("[auth] session revalidate failed, keeping existing token", error);
        return token;
      }

      if (!entry.snapshot) throw new Error("SESSION_REVOKED_USER_DELETED");
      if (!entry.snapshot.isApproved) throw new Error("SESSION_REVOKED_NOT_APPROVED");

      token.role = entry.snapshot.role;
      token.isApproved = entry.snapshot.isApproved;
      token.stationCode = entry.snapshot.stationCode;
      token.tabletAccessAllowed = entry.snapshot.tabletAccessAllowed;
      token.mobileAccessAllowed = entry.snapshot.mobileAccessAllowed;
      token.sortDualRole = entry.snapshot.sortDualRole;
      // Кэшийн анхны цагийг хэрэглэнэ: шалгах интервалыг давхар сунгахгүй.
      token.revalidatedAt = entry.at;
      return token;
    },
    async session({ session, token }: any) {
      if (token && session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.isApproved = token.isApproved;
        session.user.stationCode = token.stationCode;
        session.user.tabletAccessAllowed = token.tabletAccessAllowed;
        session.user.mobileAccessAllowed = token.mobileAccessAllowed;
        session.user.sortDualRole = token.sortDualRole;
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
  secret: process.env.NEXTAUTH_SECRET,
};
