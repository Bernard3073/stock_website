import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { findOrCreateOAuthUser, findUserByEmail } from "./db";

const googleEnabled = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
);

const providers = [
  CredentialsProvider({
    name: "Email & password",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" }
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials?.password) return null;
      const user = await findUserByEmail(credentials.email);
      if (!user || !user.password_hash) return null;
      const ok = await bcrypt.compare(credentials.password, user.password_hash);
      if (!ok) return null;
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image
      };
    }
  })
];

if (googleEnabled) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      allowDangerousEmailAccountLinking: true
    })
  );
}

export const authOptions = {
  providers,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login"
  },
  callbacks: {
    async signIn({ user, account }) {
      // For OAuth, ensure a row exists in our users table and use OUR id
      if (account?.provider && account.provider !== "credentials") {
        const dbUser = await findOrCreateOAuthUser({
          email: user.email,
          name: user.name,
          image: user.image,
          provider: account.provider
        });
        // Mutate the user object so the jwt callback sees our DB id
        user.id = dbUser.id;
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    async session({ session, token }) {
      if (token?.sub) session.user.id = token.sub;
      return session;
    }
  },
  secret: process.env.NEXTAUTH_SECRET
};

export { googleEnabled };
