import NextAuth, { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        try {
          const idToken = account.id_token;
          if (!idToken) {
            console.error("No ID Token found in Google account");
            return false;
          }

          // Use configured API URL or fall back to localhost
          let backendUrl = process.env.NEXT_PUBLIC_API_URL;
          if (!backendUrl || backendUrl === "undefined" || backendUrl === "null") {
            backendUrl = "http://127.0.0.1:5000";
          }
          // Trim trailing slash if present
          const cleanBackendUrl = backendUrl.endsWith('/') ? backendUrl.slice(0, -1) : backendUrl;

          const res = await fetch(`${cleanBackendUrl}/api/auth/google`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ idToken }),
          });

          if (!res.ok) {
            const errText = await res.text();
            console.error("Backend google verification failed:", errText);
            return false;
          }

          const data = await res.json();
          // Store backend token and user info inside the next-auth user object
          (user as any).backendToken = data.token;
          (user as any).backendUser = {
            id: data._id,
            name: data.name,
            email: data.email,
            mobile: data.mobile,
            hasPin: data.hasPin,
            hasMobile: data.hasMobile,
            hasProfileComplete: data.hasProfileComplete,
            sessionTimeout: data.sessionTimeout,
          };
          return true;
        } catch (error) {
          console.error("Error verifying Google token with backend:", error);
          return false;
        }
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.backendToken = (user as any).backendToken;
        token.backendUser = (user as any).backendUser;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        (session as any).backendToken = token.backendToken;
        (session as any).backendUser = token.backendUser;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
