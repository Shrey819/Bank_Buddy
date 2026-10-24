const { app, server } = require("./server");

const PORT = 8089;
const BASE_URL = `http://localhost:${PORT}`;

let testServer;

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASSED: ${message}`);
}

const db = require("./models");

async function runTests() {
  console.log("🚀 Starting Comprehensive Auth & Security Integration Tests for Bank Buddy...\n");

  await db.sequelize.sync({ alter: true });
  testServer = app.listen(PORT);

  try {
    const randomSuffix = Math.floor(Math.random() * 100000);
    const username = `bankuser_${randomSuffix}`;
    const email = `bankuser_${randomSuffix}@client.bank`;
    const strongPassword = "SecurePassword@2026";

    // ----------------------------------------------------
    // TEST SUITE 1: REGISTRATION INPUT VALIDATION (OWASP)
    // ----------------------------------------------------
    console.log("--- 1. Testing Signup Validation (OWASP ASVS Standard) ---");
    
    // 1.1 Empty fields
    const emptySignupRes = await fetch(`${BASE_URL}/api/v1/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    });
    assert(emptySignupRes.status === 400, "Empty signup payload rejected with 400");

    // 1.2 Invalid email format
    const badEmailRes = await fetch(`${BASE_URL}/api/v1/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Bad Email", username: "bademailuser", email: "not-an-email", password: strongPassword })
    });
    assert(badEmailRes.status === 400, "Invalid email address format rejected with 400");

    // 1.3 Weak password (< 8 chars or letters only)
    const weakPassRes = await fetch(`${BASE_URL}/api/v1/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Weak Pass", username: "weakuser", email: "weak@bank.com", password: "short" })
    });
    assert(weakPassRes.status === 400, "Password < 8 characters rejected with 400");

    const lettersOnlyPassRes = await fetch(`${BASE_URL}/api/v1/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Letters Only", username: "lettersuser", email: "letters@bank.com", password: "onlylettersnopassword" })
    });
    assert(lettersOnlyPassRes.status === 400, "Password missing numbers rejected with 400");

    // 1.4 Invalid username format
    const badUsernameRes = await fetch(`${BASE_URL}/api/v1/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Bad User", username: "bad user with spaces!", email: "user@bank.com", password: strongPassword })
    });
    assert(badUsernameRes.status === 400, "Invalid username with special characters rejected with 400");

    // 1.5 Valid Registration
    const validSignupRes = await fetch(`${BASE_URL}/api/v1/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Elena Testing", username, email, password: strongPassword })
    });
    const validSignupData = await validSignupRes.json();
    assert(validSignupRes.status === 200, "Valid registration returns 200 OK");
    assert(validSignupData.user && validSignupData.user.crn.length === 8, "Registration auto-generates 8-digit banking CRN");
    assert(typeof validSignupData.user.cardNumber === "string", "Registration generates banking card number");

    // 1.6 Duplicate Username & Email Rejection
    const dupUsernameRes = await fetch(`${BASE_URL}/api/v1/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Dup User", username, email: `diff_${email}`, password: strongPassword })
    });
    assert(dupUsernameRes.status === 400, "Duplicate username rejected with 400");

    const dupEmailRes = await fetch(`${BASE_URL}/api/v1/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Dup Email", username: `diff_${username}`, email, password: strongPassword })
    });
    assert(dupEmailRes.status === 400, "Duplicate email rejected with 400");


    // ----------------------------------------------------
    // TEST SUITE 2: AUTHENTICATION & STEP-1 MFA CHALLENGE
    // ----------------------------------------------------
    console.log("\n--- 2. Testing Login & MFA Step-1 Challenge ---");

    // 2.1 Invalid Password
    const wrongPassRes = await fetch(`${BASE_URL}/api/v1/signin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: username, password: "IncorrectPassword123" })
    });
    assert(wrongPassRes.status === 401, "Invalid password returns 401 Unauthorized");

    // 2.2 Valid Login Step 1 (by Username)
    const signinRes = await fetch(`${BASE_URL}/api/v1/signin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: username, password: strongPassword })
    });
    const signinData = await signinRes.json();
    assert(signinRes.status === 200, "Valid credentials returns 200 OK");
    assert(signinData.step === "OTP_REQUIRED", "Login triggers MFA OTP_REQUIRED step");
    assert(typeof signinData.sessionToken === "string", "Login returns pre-MFA sessionToken");
    const preMfaSessionToken = signinData.sessionToken;

    // 2.3 Valid Login Step 1 (by CRN)
    const crnSigninRes = await fetch(`${BASE_URL}/api/v1/signin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: validSignupData.user.crn, password: strongPassword })
    });
    assert(crnSigninRes.status === 200, "Login via CRN returns 200 OK");


    // ----------------------------------------------------
    // TEST SUITE 3: PRE-MFA TOKEN ISOLATION (SECURITY DEFENSE)
    // ----------------------------------------------------
    console.log("\n--- 3. Testing Pre-MFA Token Isolation & Authorization Bypass Defense ---");

    // 3.1 Pre-MFA session token cannot access protected /api/v1/me
    const preMfaMeRes = await fetch(`${BASE_URL}/api/v1/me`, {
      headers: { "Authorization": `Bearer ${preMfaSessionToken}` }
    });
    assert(preMfaMeRes.status === 403, "Pre-MFA sessionToken rejected with 403 on protected /api/v1/me");

    // 3.2 Pre-MFA session token cannot access /api/auth/getproducts
    const preMfaProductRes = await fetch(`${BASE_URL}/api/auth/getproducts`, {
      headers: { "Authorization": `Bearer ${preMfaSessionToken}` }
    });
    assert(preMfaProductRes.status === 403, "Pre-MFA sessionToken rejected with 403 on protected /api/auth/getproducts");


    // ----------------------------------------------------
    // TEST SUITE 4: MFA OTP STEP-2 VERIFICATION & TOKEN MINTING
    // ----------------------------------------------------
    console.log("\n--- 4. Testing MFA OTP Step-2 Verification ---");

    // 4.1 Wrong OTP code
    const wrongOtpRes = await fetch(`${BASE_URL}/api/v1/verify-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionToken: preMfaSessionToken, otp: "999999" })
    });
    assert(wrongOtpRes.status === 400, "Wrong OTP code returns 400 Bad Request");

    // 4.2 Correct OTP code (123456)
    const correctOtpRes = await fetch(`${BASE_URL}/api/v1/verify-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionToken: preMfaSessionToken, otp: "123456" })
    });
    const correctOtpData = await correctOtpRes.json();
    assert(correctOtpRes.status === 200, "Correct OTP returns 200 OK");
    assert(correctOtpData.step === "COMPLETED", "OTP step marked COMPLETED");
    assert(typeof correctOtpData.accessToken === "string", "MFA verified JWT accessToken returned");
    const activeJwt = correctOtpData.accessToken;

    // 4.3 Replay Attack Defense (Pre-MFA session token is invalidated once used)
    const replayOtpRes = await fetch(`${BASE_URL}/api/v1/verify-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionToken: preMfaSessionToken, otp: "123456" })
    });
    assert(replayOtpRes.status === 401, "Replaying already-used sessionToken rejected with 401");


    // ----------------------------------------------------
    // TEST SUITE 5: PROTECTED SESSION PROFILE (/api/v1/me)
    // ----------------------------------------------------
    console.log("\n--- 5. Testing Protected Session Profile (/api/v1/me) ---");

    // 5.1 Missing token
    const noTokenRes = await fetch(`${BASE_URL}/api/v1/me`);
    assert(noTokenRes.status === 403, "Missing token returns 403 Forbidden");

    // 5.2 Valid token
    const meRes = await fetch(`${BASE_URL}/api/v1/me`, {
      headers: { "Authorization": `Bearer ${activeJwt}` }
    });
    const meData = await meRes.json();
    assert(meRes.status === 200, "GET /api/v1/me returns 200 OK");
    assert(meData.user.username === username, "Profile username matches authenticated user");
    assert(meData.user.email === email, "Profile email matches authenticated user");
    assert(meData.user.password === undefined, "Security: Password hash is NEVER exposed in profile");
    assert(meData.user.otpSecret === undefined, "Security: OTP Secret is NEVER exposed in profile");


    // ----------------------------------------------------
    // TEST SUITE 6: PROTECTED RESOURCE OPERATIONS (PRODUCTS CRUD)
    // ----------------------------------------------------
    console.log("\n--- 6. Testing Protected Resource Access with Authenticated Token ---");
    const authHeaders = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${activeJwt}`
    };

    // Add Product
    const addRes = await fetch(`${BASE_URL}/api/auth/addproduct`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ name: "High-Yield Portfolio Bond", price: 50000.00 })
    });
    const addData = await addRes.json();
    assert(addRes.status === 201, "POST /api/auth/addproduct returns 201 Created");
    const productId = addData.id;

    // Get Products
    const getRes = await fetch(`${BASE_URL}/api/auth/getproducts`, { headers: authHeaders });
    assert(getRes.status === 200, "GET /api/auth/getproducts returns 200 OK");

    // Clean up created product
    const deleteRes = await fetch(`${BASE_URL}/api/auth/delete`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ id: productId })
    });
    assert(deleteRes.status === 200, "POST /api/auth/delete returns 200 OK");


    // ----------------------------------------------------
    // TEST SUITE 7: LOGOUT & TOKEN REVOCATION (OWASP INVAL)
    // ----------------------------------------------------
    console.log("\n--- 7. Testing Logout & Token Revocation ---");

    // 7.1 Call Logout
    const logoutRes = await fetch(`${BASE_URL}/api/v1/logout`, {
      method: "POST",
      headers: authHeaders
    });
    const logoutData = await logoutRes.json();
    assert(logoutRes.status === 200, "POST /api/v1/logout returns 200 OK");
    assert(logoutData.message.includes("revoked"), "Logout confirms session revoked");

    // 7.2 Verify revoked token is now REJECTED on /api/v1/me
    const postLogoutMeRes = await fetch(`${BASE_URL}/api/v1/me`, {
      headers: authHeaders
    });
    assert(postLogoutMeRes.status === 401, "Accessing /api/v1/me with revoked token rejected with 401");

    // 7.3 Verify revoked token is now REJECTED on /api/auth/getproducts
    const postLogoutProdRes = await fetch(`${BASE_URL}/api/auth/getproducts`, {
      headers: authHeaders
    });
    assert(postLogoutProdRes.status === 401, "Accessing /api/auth/getproducts with revoked token rejected with 401");

    console.log("\n🎉 ALL 22 EXTENSIVE AUTHENTICATION & SECURITY TESTS PASSED! 🎉\n");
  } catch (err) {
    console.error("Test error:", err);
    process.exit(1);
  } finally {
    if (testServer) testServer.close();
    if (server) server.close();
    await db.sequelize.close();
    process.exit(0);
  }
}

runTests();
