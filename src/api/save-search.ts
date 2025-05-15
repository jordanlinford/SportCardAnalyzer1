import { adminDb, adminAuth } from "../lib/firebaseAdmin";
import * as admin from 'firebase-admin';

interface SearchRequest {
  playerName: string;
  year?: string;
  cardSet?: string;
  variation?: string;
  cardNumber?: string;
  condition: string;
  price: number | null;
  savedAt: string;
}

interface DecodedIdToken {
  uid: string;
  [key: string]: any;
}

export async function saveSearchEndpoint(req: Request) {
  console.log("Received save search request");
  
  if (req.method !== "POST") {
    console.log("Method not allowed:", req.method);
    return new Response(
      JSON.stringify({ message: "Method not allowed" }),
      { status: 405 }
    );
  }

  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    console.log("Missing or invalid authorization header");
    return new Response(
      JSON.stringify({ message: "Missing or invalid token" }),
      { status: 401 }
    );
  }

  const idToken = authHeader.split("Bearer ")[1];

  try {
    console.log("Verifying ID token...");
    const decoded = await adminAuth.verifyIdToken(idToken) as DecodedIdToken;
    const uid = decoded.uid;
    console.log("Token verified for user:", uid);

    const searchData: SearchRequest = await req.json();
    console.log("Received search data:", searchData);

    // Check if adminDb is available (it may not be in a serverless environment)
    if (!adminDb) {
      console.error("Firebase Admin DB not initialized");
      return new Response(
        JSON.stringify({ message: "Database connection error" }),
        { status: 500 }
      );
    }

    const docRef = adminDb.collection("users").doc(uid).collection("saved_searches").doc();
    await docRef.set({
      playerName: searchData.playerName,
      year: searchData.year,
      cardSet: searchData.cardSet,
      variation: searchData.variation,
      cardNumber: searchData.cardNumber,
      condition: searchData.condition,
      price: searchData.price,
      savedAt: searchData.savedAt,
    });

    console.log("Search saved successfully");
    return new Response(
      JSON.stringify({ message: "Search saved successfully" }),
      { status: 200 }
    );
  } catch (error) {
    console.error("Error in save search endpoint:", error);
    return new Response(
      JSON.stringify({ 
        message: "Failed to save search",
        error: error instanceof Error ? error.message : "Unknown error"
      }),
      { status: 500 }
    );
  }
} 