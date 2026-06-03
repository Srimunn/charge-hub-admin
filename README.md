# EV Charging Station Admin Dashboard

An advanced EV Charging Platform Operator System featuring real-time charging session trackers, station and connector health metrics, live telemetry, reports, and a controlled fault simulation system.

---

## 📋 System Requirements

To run this application locally, you will need:
1. **Node.js** (v18 or higher recommended)
2. **MongoDB** (Local Community Server OR a MongoDB Atlas cloud database URI)

---

## 🚀 Quick Start Guide

Follow these steps to set up and run the application on your laptop:

### 1. Clone the Repository
```bash
git clone https://github.com/Srimunn/charge-hub-admin.git
cd charge-hub-admin
```

### 2. Configure Environment Variables
You need to create a `.env` file inside the `backend` directory to store configuration keys.

Create a file at `backend/.env` and add the following content:
```env
# JWT & Security Configuration
JWT_SECRET=ba7561c9dc7e415382906432f3852f44
TOKEN_EXPIRY=7d

# MongoDB Connection (use your local URI or Atlas connection string)
MONGO_URI=mongodb://127.0.0.1:27017/ev_chargings

# Razorpay Test Mode Keys (for test transaction processing)
RAZORPAY_KEY_ID=rzp_test_SrF5xp9EfzQMlu
RAZORPAY_KEY_SECRET=xByWuuQVHAsOM064HPs8anAA
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret_here
```

### 3. Install Dependencies
Run this command in the project root directory to install all frontend and backend packages:
```bash
npm install
```

### 4. Seed the Database (Optional but Recommended)
To populate the database with initial stations, users, and faults:
```bash
node backend/seeder.js
```

### 5. Run the Application
You will need to start both the **Backend API server** and the **Frontend dev server**:

#### Start the Backend API Server
In your terminal, run:
```bash
npm run backend
```
*The backend API server will start on [http://localhost:5000](http://localhost:5000).*

#### Start the Frontend Web App
Open a new terminal window/tab, navigate to the root directory, and run:
```bash
npm run dev
```
*The Next.js frontend admin panel will start on [http://localhost:3000](http://localhost:3000).*

---

## 🛠️ Testing the Fault Simulation System

Once both servers are running:
1. Log in to the Admin Panel and navigate to **Live Sessions**.
2. Click **Simulate Start Session** to spin up an active charging station.
3. On the active station card, click the **Simulate Fault** button.
4. Choose any of the test faults (e.g., *Over Temp*, *Over Voltage*, *Over Current*, or *E-Stop*).
5. Watch the charging session immediately stop, and verify that the station status changes to **Faulted** across the dashboard, Live Sessions, and Station Details screens in real time.
6. To restore the station, navigate to the **Faults & Alerts** page and click **Resolve**.
