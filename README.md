# MadEdge Backend Showcase

> **Note:** The main repository for the **MadEdge** e-commerce platform is currently private due to commercial reasons. 

I have extracted these specific backend modules into this public showcase repository to demonstrate my architectural approach, coding standards, and experience with third-party integrations for the technical review.

## Included Modules:

1. **`api/paypal.ts` (Payments & Security)**
   - Demonstrates secure server-side price calculation and validation before creating a payment intent (preventing client-side price manipulation).
   - Integration with PayPal Checkout API.

2. **`actions/subscribers.ts` (Asynchronous Tasks & SendGrid)**
   - Demonstrates bulk email sending using SendGrid.
   - Utilizes `Promise.all` for parallel processing and robust error handling for failed deliveries.

3. **`services/auth.ts` (Service-Oriented Architecture)**
   - Demonstrates isolation of business logic and database (Supabase) interactions into strongly typed, reusable services.
