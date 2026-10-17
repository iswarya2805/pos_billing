# Razorpay UPI setup

1. Create or sign in to a Razorpay account and enable **Test Mode**.
2. Generate Test API keys from the Razorpay Dashboard.
3. Add these values to `backend/.env` (never put the secret in frontend code):

   ```env
   RAZORPAY_KEY_ID=rzp_test_...
   RAZORPAY_KEY_SECRET=...
   ```

4. Restart the backend and frontend. In Billing, select **UPI** and complete a test payment in Razorpay Checkout.
5. Switch to Live API keys only after completing Razorpay's account activation and testing. Keep the key secret on the backend.

The backend calculates the amount from product records, creates the Razorpay order, verifies the Checkout signature, confirms/captures the payment, and only then creates the paid bill and reduces stock. A captured payment is tied to one bill using the Razorpay order ID, making verification retries safe.
