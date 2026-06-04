# Nimbuz Deployment Guide

This guide provides the necessary settings to deploy the **Charge Hub Admin** application on Nimbuz. The repository is structured to allow independent deployment of the backend and the frontend.

---

## 🔌 Backend Deployment Settings

The Express.js backend is located in the `backend` subdirectory and operates independently of the frontend.

| Parameter | Recommended Setting |
| :--- | :--- |
| **Folder Path** | `backend` |
| **Port** | `5000` (or dynamic via `process.env.PORT`) |
| **Health Endpoint** | `/api/health` |
| **Build Command** | `npm install` |
| **Start Command** | `npm start` |

### Required Environment Variables (Backend)

Ensure the following environment variables are set in the Nimbuz environment configuration for the backend:

- `MONGO_URI`: MongoDB Atlas connection string.
- `JWT_SECRET`: Secret key for JWT token generation.
- `CLOUD_NAME`: Cloudinary cloud name.
- `CLOUD_API_KEY`: Cloudinary API key.
- `CLOUD_API_SECRET`: Cloudinary API secret.
- `RAZORPAY_KEY_ID`: Razorpay public key ID.
- `RAZORPAY_KEY_SECRET`: Razorpay secret key.
- `RAZORPAY_WEBHOOK_SECRET`: Razorpay webhook authentication secret.
- `CORS_ORIGIN`: Allowed origins for CORS (e.g., your frontend URL or `*`).

---

## 🌐 Frontend Deployment Settings

The Next.js frontend is located in the root directory.

| Parameter | Recommended Setting |
| :--- | :--- |
| **Folder Path** | `/` (Root directory) |
| **Build Command** | `npm run build` |
| **Start Command** | `npm start` |

### Environment Variables (Frontend)

- `NEXT_PUBLIC_API_URL`: The URL of your deployed Express backend.
