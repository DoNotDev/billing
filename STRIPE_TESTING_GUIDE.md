# 🧪 Billing System Testing Guide

## 🎯 Testing Your Schema-Driven Billing System

### 📋 **Prerequisites**

1. **Stripe Test Account**

   ```bash
   # Get your test keys from Stripe Dashboard
   export STRIPE_SECRET_KEY="<stripe_secret_key>"
   export STRIPE_PUBLISHABLE_KEY="pk_test_..."
   export STRIPE_WEBHOOK_SECRET="whsec_..."
   ```

2. **Environment Setup**

   ```bash
   # Install dependencies
   bun install

   # Set up environment variables
   cp .env.example .env
   # Edit .env with your Stripe keys
   ```

### 🧪 **1. Unit Tests**

```bash
# Run unit tests
bun test

# Run specific test files
bun test webhookHandler.test.ts
bun test PurchaseButton.test.tsx
```

### 🧪 **2. Integration Tests**

```bash
# Run integration tests
bun test billingIntegration.test.ts

# Test billing config validation
bun test -- --grep "billing config"
```

### 🧪 **3. End-to-End Tests**

```bash
# Run E2E test script
node scripts/test-billing-system.js

# This will:
# ✅ Create test customer
# ✅ Create test product
# ✅ Create checkout session
# ✅ Simulate webhook event
# ✅ Test GitHub access flow
# ✅ Clean up test data
```

### 🧪 **4. Manual Testing**

#### **Step 1: Start Development Server**

```bash
# Start demo app
cd apps/demo
bun run dev

# Start functions (in another terminal)
cd functions
bun run dev
```

#### **Step 2: Test Purchase Flow**

1. **Visit**: `http://localhost:3000/purchase`
2. **Verify**: Products are displayed correctly
3. **Click**: "Buy Early Bird Lifetime" button
4. **Verify**: Redirects to Stripe checkout
5. **Use Test Card**: `4242 4242 4242 4242`
6. **Complete**: Payment process
7. **Verify**: Redirects to success page

#### **Step 3: Test Webhook Processing**

1. **Check Logs**: Look for webhook processing logs
2. **Verify**: GitHub access granted (check console logs)
3. **Verify**: User subscription updated

#### **Step 4: Test Subscription Cancellation**

1. **Go to**: Stripe Dashboard → Customers
2. **Find**: Your test customer
3. **Cancel**: Active subscription
4. **Verify**: Webhook processes cancellation
5. **Verify**: GitHub access revoked (check console logs)

### 🧪 **5. Stripe Test Cards**

```bash
# Successful payment
4242 4242 4242 4242

# Declined payment
4000 0000 0000 0002

# Requires authentication
4000 0025 0000 3155

# Insufficient funds
4000 0000 0000 9995
```

### 🧪 **6. Webhook Testing**

#### **Using Stripe CLI**

```bash
# Install Stripe CLI
npm install -g stripe

# Login to Stripe
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:5001/webhook

# Test webhook
stripe trigger checkout.session.completed
```

#### **Using ngrok (Alternative)**

```bash
# Install ngrok
npm install -g ngrok

# Expose local server
ngrok http 5001

# Use ngrok URL in Stripe webhook settings
# https://abc123.ngrok.io/webhook
```

### 🧪 **7. GitHub Integration Testing**

#### **Test GitHub Access Grant**

1. **Complete Purchase**: Use test card
2. **Check Logs**: Look for GitHub access logs
3. **Verify**: User added to GitHub team (if real GitHub integration)

#### **Test GitHub Access Revoke**

1. **Cancel Subscription**: In Stripe Dashboard
2. **Check Logs**: Look for GitHub revoke logs
3. **Verify**: User removed from GitHub team

### 🧪 **8. Error Testing**

#### **Test Invalid Config**

```typescript
// Test with invalid billing config
const invalidConfig = { invalid: 'config' };
// Should throw validation error
```

#### **Test Webhook Failures**

```typescript
// Test with invalid signature
// Should handle gracefully
```

#### **Test GitHub API Failures**

```typescript
// Test with invalid GitHub credentials
// Should log error but not fail webhook
```

### 🧪 **9. Performance Testing**

#### **Load Testing**

```bash
# Test webhook processing under load
for i in {1..100}; do
  curl -X POST http://localhost:5001/webhook \
    -H "Content-Type: application/json" \
    -d '{"test": "webhook"}'
done
```

#### **Memory Testing**

```bash
# Monitor memory usage during webhook processing
node --inspect scripts/test-billing-system.js
```

### 🧪 **10. Security Testing**

#### **Test Webhook Signature Validation**

```bash
# Test with invalid signature
curl -X POST http://localhost:5001/webhook \
  -H "stripe-signature: invalid_signature" \
  -d '{"test": "data"}'
# Should reject request
```

#### **Test Input Validation**

```bash
# Test with malformed data
curl -X POST http://localhost:5001/webhook \
  -H "stripe-signature: valid_signature" \
  -d '{"malformed": "data"}'
# Should handle gracefully
```

### 🧪 **11. Monitoring & Debugging**

#### **Enable Debug Logs**

```bash
# Set debug environment variable
export DEBUG=billing:*
export NODE_ENV=development
```

#### **Check Logs**

```bash
# View function logs
firebase functions:log

# View webhook logs
tail -f logs/webhook.log
```

### 🧪 **12. Test Checklist**

- [ ] **Unit Tests**: All components tested
- [ ] **Integration Tests**: Billing config validated
- [ ] **E2E Tests**: Complete flow tested
- [ ] **Manual Tests**: UI and UX verified
- [ ] **Webhook Tests**: Stripe events processed
- [ ] **GitHub Tests**: Access granted/revoked
- [ ] **Error Tests**: Failures handled gracefully
- [ ] **Performance Tests**: System handles load
- [ ] **Security Tests**: Input validation works
- [ ] **Monitoring**: Logs and debugging enabled

### 🎯 **Success Criteria**

✅ **All tests pass**  
✅ **Webhook processes events correctly**  
✅ **GitHub access granted/revoked**  
✅ **UI renders products correctly**  
✅ **Payments process successfully**  
✅ **Errors handled gracefully**  
✅ **Performance meets requirements**  
✅ **Security measures in place**

**Your billing system is production-ready!** 🎉
