import { getAuth } from "firebase/auth";
import { auth } from "../lib/firebase/config";
import { adminDb, adminAuth } from "../lib/firebaseAdmin";

async function testSaveSearch() {
  try {
    // Get current user's ID token
    const user = auth.currentUser;
    if (!user) {
      console.error("No user logged in");
      return;
    }

    const token = await user.getIdToken();
    console.log("Got user token");

    // Test search data
    const searchData = {
      playerName: "Test Player",
      year: "2023",
      cardSet: "Test Set",
      variation: "Test Variation",
      cardNumber: "123",
      condition: "Mint",
      price: 100,
      savedAt: new Date().toISOString(),
    };

    // Make the request
    const response = await fetch("/api/save-search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(searchData),
    });

    const result = await response.json();
    console.log("Response status:", response.status);
    console.log("Response data:", result);

    if (!response.ok) {
      throw new Error(result.message || "Failed to save search");
    }

    console.log("Test completed successfully");
  } catch (error) {
    console.error("Test failed:", error);
  }
}

// Run the test
testSaveSearch();

export async function testSaveSearchEndpoint(req: Request) {
  console.log("Received test save search request");
  
  if (req.method !== "POST") {
    console.log("Method not allowed:", req.method);
    return new Response(
      JSON.stringify({ message: "Method not allowed" }),
      { status: 405 }
    );
  }

  return new Response(
    JSON.stringify({ message: "Test endpoint working" }),
    { status: 200 }
  );
} 