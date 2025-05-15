import { v4 as uuidv4 } from "uuid";

/**
 * Get or create an anonymous user ID stored in localStorage
 * @returns Anonymous user ID for non-authenticated users
 */
export function getAnonymousId(): string {
  let anonymousId = localStorage.getItem('anonymousUserId');
  if (!anonymousId) {
    anonymousId = uuidv4();
    localStorage.setItem('anonymousUserId', anonymousId);
  }
  return anonymousId;
} 