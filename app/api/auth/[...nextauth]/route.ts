import dotenv from "dotenv";
import path from "path";

// Load environment variables from .env files at runtime
dotenv.config();
if (process.env.NODE_ENV === "production") {
  dotenv.config({ path: path.join(process.cwd(), ".env.production") });
}

import NextAuth, { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

// Resolve backend URL: prefer server-side BACKEND_API_URL, fall back to NEXT_PUBLIC_API_URL
const getBackendUrl = (): string => {
  const serverUrl = process.env.BACKEND_API_URL;
  const publicUrl = process.env.NEXT_PUBLIC_API_URL;

  for (const url of [serverUrl, publicUrl]) {
    if (url && url !== "undefined" && url !== "null" && url.trim() !== "") {
      return url.replace(/\/$/, "");
    }
  }
  // Final fallback for local development
  return process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
};

const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      authorization: {
        params: {
          prompt: "select_account",
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        try {
          const idToken = account.id_token;
          if (!idToken) {
            console.error("[NextAuth] No ID Token found in Google account");
            return false;
          }

          const backendUrl = getBackendUrl();
          console.log(`[NextAuth] Forwarding Google token to backend: ${backendUrl}/api/auth/google`);

          const res = await fetch(`${backendUrl}/api/auth/google`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ idToken }),
          });

          if (!res.ok) {
            const errText = await res.text();
            console.error("[NextAuth] Backend google verification failed:", res.status, errText);
            return false;
          }

          const data = await res.json();
          console.log(`[NextAuth] Google auth successful for user: ${data.email}`);

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
          console.error("[NextAuth] Error verifying Google token with backend:", error);
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
    error: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET,
  // In NextAuth v4, production URL is controlled via NEXTAUTH_URL env var.
  // Ensure NEXTAUTH_URL is set to your deployed frontend URL in production.
  // useSecureCookies is automatically set to true when NEXTAUTH_URL starts with https://
  debug: process.env.NODE_ENV === "development",
};

import { NextRequest } from "next/server";

const handler = async (req: NextRequest, ctx: any) => {
  // Dynamically resolve NEXTAUTH_URL based on incoming request headers to prevent localhost redirect
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") || "http";
  
  if (host) {
    const isLocalRequest = host.includes("localhost") || host.includes("127.0.0.1");
    // If NEXTAUTH_URL is not set, or is pointing to localhost but this request comes from a public host,
    // dynamically override it with the detected request origin.
    if (!process.env.NEXTAUTH_URL || (process.env.NEXTAUTH_URL.includes("localhost") && !isLocalRequest)) {
      process.env.NEXTAUTH_URL = `${proto}://${host}`;
      console.log(`[NextAuth] Dynamically setting NEXTAUTH_URL to: ${process.env.NEXTAUTH_URL}`);
    }
  }

  // Under Next.js App Router, NextAuth v4 handles (req, ctx, options) signature dynamically.
  return await NextAuth(req, ctx, authOptions);
};

export { handler as GET, handler as POST };
