---
status: proposed
---

# Duplicate prevention: sales confirm a saved draft; receipts and adjustments carry an idempotency key

The TOR asks for two different things. SAL-03 says a duplicate confirmation must not create another sale. GR-04 says a repeated or retried receipt must return the original, yet "a deliberately new receipt must still be possible". Sales already have persisted drafts (SAL-02), so confirming is a state transition on a known id: `confirm(saleId)` on a confirmed sale returns it unchanged. Receipts and stock adjustments have no draft, so the browser generates an idempotency key (UUID) when the form opens, sends it with every retry, and only replaces it after a success. Same key means same operation; a new key means a deliberately new document.

## Key rules

- The key is stored on the document, with a unique constraint, **only when the operation succeeds**. A rejected attempt (e.g. receiving 21 of 20) stores nothing, so the user can correct the form and resend with the same key.
- Same key, same content: return the original document with `replayed: true`; no stock change, no new movement.
- Same key, different content (compared by a hash of the normalized request): reject with `IDEMPOTENCY_KEY_REUSED`, kind `correct`.
- Keys are unique across the whole system, not per user.
- Concurrent requests with the same key: the unique constraint makes exactly one insert win; the loser rolls back and returns the winner's document as a replay.

This defines how AC-02 ("resend the same request") and AC-06 ("resending the same request") pass, so the interpretation is clarification C-06 and needs RetailOne's signature.

## Considered options

- **Deduplicate by request content** (same PO, same quantities within N seconds): would silently swallow a deliberately identical second delivery, which GR-04 forbids.
- **Server-created draft receipts confirmed by id** (same as sales): adds a draft state the TOR doesn't describe for receipts, plus cleanup of abandoned drafts.
