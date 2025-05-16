# Profile Page Structure

This document defines the permanent structure of the profile page. Any changes to this structure must be carefully considered and documented.

## Core Components

1. **Profile Overview Card**
   - User avatar
   - Username
   - Email
   - Subscription badge
   - Member since date
   - Collection stats (display cases and cards)

2. **Account Settings Card**
   - Username update
   - Email update
   - Password update with re-authentication

3. **Subscription Management Card**
   - Current subscription display
   - Upgrade options for Rookie users
   - Subscription management for paid users

## Price IDs

### Star Plan
- Monthly: `price_1RDB4fGCix0pRkbmlNdsyo7s`
- Annual: `price_1RN5uOGCix0pRkbmK2kCjqw4`

### Veteran Plan
- Monthly: `price_1RDB4fGCix0pRkbmmPrBX8FE`
- Annual: `price_1RN5vwGCix0pRkbmT65EllS1`

## Important Notes

1. This structure must be maintained for consistency and user experience
2. Price IDs must never be changed without updating this document
3. The subscription management flow must always include:
   - Clear plan comparison
   - Monthly/Annual options
   - Stripe integration
   - Portal session management

## Backup Files
- Main file: `src/pages/ProfilePage.tsx`
- Backup: `src/pages/ProfilePage.tsx.backup`

## Git History
- Commit: "PERMANENT: Profile page structure with subscription management and account settings"
- Date: [Current Date]

## Dependencies
- Firebase Auth
- Stripe
- React Router
- UI Components (shadcn/ui)
- Toast notifications (sonner) 