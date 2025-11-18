API Endpoints

**1. Signup - Initiate**

Checks if the user already exists; if not, it triggers the Twilio Verify API to send an OTP to the mobile number.

Endpoint: POST /api/auth/signup/init


**2. Signup - Verify & Register**

Verifies the OTP provided by the user and, if successful, hashes the password and saves the new user to the database.

Endpoint: POST /api/auth/signup/verify


**3. Login - Initiate**

Validates that the mobile number exists in the database, then sends an OTP to initiate the two-factor authentication login flow.

Endpoint: POST /api/auth/login/init


**4. Login - Verify & Token Generation**

Authenticates the OTP and the password; upon success, it returns a signed JWT token for accessing protected routes.

Endpoint: POST /api/auth/login/verify


**5. Profile (JWT Verification)**

A protected route that validates the Authorization: Bearer <token> header to ensure the request is coming from an authenticated user.

Endpoint: GET /api/profile
