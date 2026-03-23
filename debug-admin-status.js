// Debug script - Chạy trong console của browser
// Copy và paste vào Console tab trong DevTools

console.log("=== DEBUG ADMIN STATUS ===");
console.log("");

// Check localStorage
const token = localStorage.getItem("token");
const userStr = localStorage.getItem("user");

console.log("1. Token exists:", !!token);
console.log("");

if (userStr) {
  try {
    const user = JSON.parse(userStr);
    console.log("2. User data:", user);
    console.log("");
    console.log("3. Email:", user.email);
    console.log("4. Is Admin:", user.isAdmin);
    console.log("5. Is Admin Type:", typeof user.isAdmin);
    console.log("");

    if (user.isAdmin === true) {
      console.log("✅ User IS ADMIN");
    } else {
      console.log("❌ User is NOT admin");
      console.log("   - Current value:", user.isAdmin);
      console.log("   - To fix: Re-login or manually set:");
      console.log("     user.isAdmin = true");
      console.log('     localStorage.setItem("user", JSON.stringify(user))');
    }
  } catch (e) {
    console.error("❌ Error parsing user data:", e);
  }
} else {
  console.log("❌ No user data in localStorage");
  console.log("   Please login first");
}

console.log("");
console.log("=== END DEBUG ===");
