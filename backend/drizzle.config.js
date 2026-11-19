// drizzle-kit config: `npx drizzle-kit generate` creates SQL migrations in ./drizzle
// from ./db/schema.js. Migrations are applied automatically when the server starts.
export default {
  dialect: "postgresql",
  schema: "./db/schema.js",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL || "postgres://localhost:5432/charge_hub" },
};
