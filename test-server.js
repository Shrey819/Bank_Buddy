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

async function runTests() {
  console.log("🚀 Starting Integration Tests for nodejs-crud-using-jwt-auth...\n");

  testServer = app.listen(PORT);

  try {
    const randomSuffix = Math.floor(Math.random() * 100000);
    const username = `user_${randomSuffix}`;
    const email = `user_${randomSuffix}@example.com`;
    const password = "password123";

    // 1. Signup
    console.log("--- 1. Testing Signup ---");
    const signupRes = await fetch(`${BASE_URL}/api/v1/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, email, password })
    });
    const signupData = await signupRes.json();
    assert(signupRes.status === 200, "POST /api/v1/signup returns 200");
    assert(signupData.message === "User successfully registered", "Signup success message");

    // 2. Signin
    console.log("\n--- 2. Testing Signin (JWT Token Generation) ---");
    const signinRes = await fetch(`${BASE_URL}/api/v1/signin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });
    const signinData = await signinRes.json();
    assert(signinRes.status === 200, "POST /api/v1/signin returns 200");
    assert(typeof signinData.accessToken === "string", "Signin returns accessToken string");

    const token = signinData.accessToken;
    const authHeaders = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    };

    // 3. Unauthenticated request rejected
    console.log("\n--- 3. Testing JWT Protection ---");
    const unauthRes = await fetch(`${BASE_URL}/api/auth/getproducts`);
    assert(unauthRes.status === 403, "Unauthenticated request returns 403 No token provided");

    // 4. Add Product
    console.log("\n--- 4. Testing Create Product ---");
    const addRes = await fetch(`${BASE_URL}/api/auth/addproduct`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ name: "Mechanical Keyboard", price: 89.99 })
    });
    const addData = await addRes.json();
    assert(addRes.status === 201, "POST /api/auth/addproduct returns 201 Created");
    assert(addData.name === "Mechanical Keyboard", "Product created with correct name");
    const productId = addData.id;

    // 5. Get All Products
    console.log("\n--- 5. Testing Get All Products ---");
    const getRes = await fetch(`${BASE_URL}/api/auth/getproducts`, {
      headers: authHeaders
    });
    const getData = await getRes.json();
    assert(getRes.status === 200, "GET /api/auth/getproducts returns 200");
    assert(Array.isArray(getData) && getData.length > 0, "Products array returned");

    // 6. Find Product By ID
    console.log("\n--- 6. Testing Find Product By ID ---");
    const findRes = await fetch(`${BASE_URL}/api/auth/getproductbyid`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ id: productId })
    });
    const findData = await findRes.json();
    assert(findRes.status === 200, "POST /api/auth/getproductbyid returns 200");
    assert(findData.id === productId, "Found correct product by ID");

    // 7. Update Product
    console.log("\n--- 7. Testing Update Product ---");
    const updateRes = await fetch(`${BASE_URL}/api/auth/update`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ id: productId, name: "RGB Mechanical Keyboard", price: 109.99 })
    });
    const updateData = await updateRes.json();
    assert(updateRes.status === 200, "POST /api/auth/update returns 200");
    assert(updateData.message === "Product successfully updated.", "Update confirmed");

    // 8. Delete Product
    console.log("\n--- 8. Testing Delete Product ---");
    const deleteRes = await fetch(`${BASE_URL}/api/auth/delete`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ id: productId })
    });
    const deleteData = await deleteRes.json();
    assert(deleteRes.status === 200, "POST /api/auth/delete returns 200");
    assert(deleteData.message === "Product successfully deleted.", "Delete confirmed");

    console.log("\n🎉 ALL TESTS PASSED SUCCESSFULLY! 🎉\n");
  } catch (err) {
    console.error("Test error:", err);
    process.exit(1);
  } finally {
    if (testServer) testServer.close();
    if (server) server.close();
  }
}

runTests();
