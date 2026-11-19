import { defineRailway, github, postgres, project, service, volume } from "railway/iac";

// Railway project "charge-hub-operator": operator dashboard + API (shared with the mobile app) + PostgreSQL.
// Variables are NOT managed here (secrets are set in the Railway dashboard / CLI). See DEPLOYMENT_GUIDE.md.
// Deploy branch: switch to "main" after the migration PR is merged.
const BRANCH = "deploy/railway-migration";
const REGION = "asia-southeast1-eqsg3a";

export default defineRailway(() => {
  const Postgres = postgres("Postgres", { region: REGION });
  Postgres.networking = { privateNetworkEndpoint: "postgres" };
  const postgresVolume = volume("postgres-volume", {
    alerts: { usage: { "100": {}, "80": {}, "95": {} } },
    allowOnlineResize: true,
    region: REGION,
    sizeMB: 5000,
  });

  // Express API, Socket.io and OCPP central system (backend/Dockerfile). Migrations run at startup.
  const chargeHubBackend = service("charge-hub-backend", {
    source: github("Srimunn/charge-hub-admin", { branch: BRANCH, rootDirectory: "backend" }),
    build: { builder: "DOCKERFILE", dockerfilePath: "Dockerfile", watchPatterns: ["/backend/**"] },
    healthcheck: "/api/health",
    healthcheckTimeout: 300,
    replicas: { [REGION]: 1 },
  });
  // Private hostname used by the frontend's server side (BACKEND_API_URL).
  chargeHubBackend.networking = { privateNetworkEndpoint: "charge-hub-backend" };

  // Next.js operator dashboard (root Dockerfile).
  const chargeHubFrontend = service("charge-hub-frontend", {
    source: github("Srimunn/charge-hub-admin", { branch: BRANCH }),
    build: {
      builder: "DOCKERFILE",
      dockerfilePath: "Dockerfile",
      watchPatterns: ["/**", "!/backend/**", "!/hardware/**", "!/**/*.md"],
    },
    healthcheck: "/health",
    healthcheckTimeout: 120,
    replicas: { [REGION]: 1 },
  });

  return project("charge-hub-operator", {
    variables: { managed: false },
    resources: [chargeHubFrontend, chargeHubBackend, Postgres, postgresVolume],
  });
});
