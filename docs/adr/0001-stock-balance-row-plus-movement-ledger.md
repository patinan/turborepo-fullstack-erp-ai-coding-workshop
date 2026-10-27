---
status: proposed
---

# Stock is a balance row per product and store, plus an append-only movement ledger

Each product and store pair has one stock balance row (which also holds its reorder threshold), and every change appends a stock movement with the balance before and after. Posting a document updates the balance and inserts the movement in the same database transaction (INV-02, INV-03). We store the balance instead of summing movements on read because stock search and stock view must stay under a 2-second p95 at 10,000 movements (NFR-05), and a stored row gives concurrent writers one thing to serialize on (INV-04).

## Concurrency

- **Decreases** (sales, negative adjustments) use one conditional update: `quantity = quantity - n WHERE quantity >= n`. Zero rows updated means insufficient stock. No read-then-write, so the balance the browser showed is never trusted.
- **Multi-line documents** touch balance rows in ascending product id order, so two sales on the same products cannot deadlock.
- **Goods receipts** lock the purchase order row (`SELECT … FOR UPDATE`) before checking outstanding quantities, so concurrent receipts on one PO cannot exceed the ordered quantity in total (GR-05).
- A serialization failure or deadlock that still occurs maps to the `CONFLICT_RETRY` error (kind `retry`); the request is never half-applied.

## Guards in the database

- `CHECK (quantity >= 0)` on the balance row: a bug elsewhere cannot make stock negative.
- A trigger rejects `UPDATE` and `DELETE` on stock movements. `TRUNCATE` (used only by test resets) is unaffected.

## Opening balances

There is no opening-balance screen. Every balance starts at zero; the seed writes `OPENING` movements, and in live use a manager records a stock adjustment with the reason "นับสต็อกตั้งต้น". Either way `balance = opening + movements` holds and is checked by an integration-test invariant after every scenario.

## Considered options

- **Balance computed by summing movements**: always consistent by construction, but every stock read aggregates the ledger and concurrent decreases need a lock on something anyway.
- **Optimistic locking with a version column**: works, but under AC-07-style contention the loser must retry, which pushes retry logic into every caller. The conditional update gives the same safety in one statement.
