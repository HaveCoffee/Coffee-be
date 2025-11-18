# **Coffee-be**

Backend Codebase for Coffee Application.

This repository contains the backend services for the Coffee App, built using **Node.js**, **Express**, **PostgreSQL**, and **Twilio** (for OTP-based authentication).

## **Currently Developed Services**

1. **Auth Service**: Handles user registration, login, and JWT session management using Mobile Number \+ OTP \+ Password.

## **Setup & Installation**

**Install Dependencies**  
npm install

1. **Database Setup**
    * Ensure PostgreSQL is running.
    * Create a database named `auth_db`.
    * Run the schema command:  
      CREATE TABLE Users (mobile\_number VARCHAR(20) PRIMARY KEY, password VARCHAR(255) NOT NULL);


2. **Environment Variables** Create a `.env` file in the root directory with the following:  
   PORT=3000  
   DB\_USER=postgres  
   DB\_HOST=localhost  
   DB\_NAME=auth\_db  
   DB\_PASSWORD=your\_db\_pass  
   TWILIO\_ACCOUNT\_SID=AC...  
   TWILIO\_AUTH\_TOKEN=...  
   TWILIO\_VERIFY\_SERVICE\_SID=VA...  
   JWT\_SECRET=your\_secret\_key

3. **Run Server**  
   npm run dev