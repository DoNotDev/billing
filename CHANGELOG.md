# @donotdev/billing

## 0.1.45

### Patch Changes

- New StripeOrder checkout: `StripeCheckoutButton` takes `lineItems` (`[{ productId, quantity }]`, priced on the server) and `useStripeBilling('checkout')` takes `billingConfigKey` + `lineItems`. Additive: omitted, the server checks out the single product of `configKey`.
- 0.1.x checkout is unchanged: `StripeCheckoutButton` still sends `priceId`, `unitAmount` + `productName`, `currency` and `mode`, and still puts `billingConfigKey` in `metadata` (also sent top-level). `PurchaseButton` / `SubscriptionButton` keep `config: StripePayment` / `StripeSubscription` and send `config.priceId`; `ProductCard` forwards `name`, `price`, `currency`, `priceId` and `allowPromotionCodes` as before.
- `StripeCheckoutButton` no longer requires `priceId` or dynamic pricing when a `configKey` (or `metadata.billingConfigKey`) is given: the server uses the back-config priceId. Without any of them, `onError` still fires before any request.
- `ProductCard` `allowPromotionCodes={false}` now reaches the checkout (0.1.x dropped it for payments).
- `checkout` sends `customerEmail` only when the user has an email (0.1.x sent an empty string, which failed server validation).

## 0.1.43

### Patch Changes

- a4c57d7: bugfixes and performance upgrades
- Updated dependencies [98d641c]
- Updated dependencies [a4c57d7]
- Updated dependencies [2b8210a]
  - @donotdev/core@0.1.43
  - @donotdev/components@0.1.44
  - @donotdev/auth@0.1.43
