# Retail ERP — Release 1 specification

Version 0.1 (draft for the Requirements baseline milestone) · 26 October 2026 · Supplier: this repository's team · Client: RetailOne Co Ltd

Source: `docs/tors/Retail_ERP_TOR_EN.pdf` v1.1 (the `.md` beside it is a text conversion). Where this spec and the TOR disagree, the TOR wins until a clarification in `docs/clarifications.md` is approved.

Companion documents:

- `docs/clarifications.md`: the clarification register (TOR §10.1). Every rule here marked **[C-xx]** or **[Q-xx]** depends on an entry there.
- `docs/traceability.md`: one row per requirement → acceptance criteria → delivered routes/screens → tests → result.
- `GLOSSARY.md`: the domain language. Terms in this spec are used as defined there.
- `docs/adr/0001`–`0004`: the hard-to-reverse design decisions.

---

## 1. Release scope

### 1.1 In scope

The whole functional and quality baseline of the TOR:

- Master data: MD-01 to MD-03
- Stock: INV-01 to INV-05, shared data rules (§4.3)
- Purchasing and receiving: PO-01 to PO-04, GR-01 to GR-05
- Sales and reporting: SAL-01 to SAL-04, RPT-01 to RPT-04, display rules (§6.2)
- Quality: NFR-01 to NFR-06
- Deliverables: §7.2, plus the deployment, rollback and backup/restore demonstration in §9.3

The TOR gives no ID to some binding text. This spec assigns these IDs to it:

| ID     | TOR source                           | Requirement                                                                                                                                                                             |
| ------ | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SHR-01 | §4.3                                 | Document numbers are unique.                                                                                                                                                            |
| SHR-02 | §4.3                                 | Master-data changes never alter names, prices or details on historical documents; documents keep transaction-time snapshots.                                                            |
| SHR-03 | §4.3                                 | Money has two decimals; line amount = quantity × unit price; document total = sum of line amounts. No discounts, taxes, valuation or COGS.                                              |
| UI-01  | §6.2 "Display and calculation rules" | Reporting day boundaries in Asia/Bangkok, by sale confirmation time; zero totals and an empty-state message when nothing matches; money shown to two decimals.                          |
| UI-02  | §6.2 last paragraph                  | Lists paginate and order newest first; screens show loading, success and error states; errors say whether to correct input or retry.                                                    |
| DEL-01 | §7.2                                 | Delivery package: source, install/startup/test instructions, example configuration, migrations, seed data, test accounts, API documentation, known limitations, operating instructions. |
| DEL-02 | §9.3                                 | Deployment and rollback instructions; backup and restoration demonstrated in the agreed environment.                                                                                    |

### 1.2 Out of scope

- Everything in TOR §3 Exclusions.
- CR-01 damaged goods (under consideration).
- The future capabilities behind Q-01, Q-03, Q-04 and Q-05. Release 1 keeps the TOR's stated positions: one manager approves, receipts use the system timestamp, no reversals, one base unit.
- Hosting, monitoring, incident handling and support ownership. These are RetailOne decisions [C-24]. The supplier delivers procedures for them, not services.
- Not in release 1 (also recorded as known limitations):
  - login lockout [C-15]
  - multi-line stock counts [C-10]
  - deactivating stores [C-13]
  - self-service password change [C-14]
  - export of movement history [C-12]

### 1.3 Delivery order

The release is built in vertical slices, each usable and tested before the next one starts:

1. Identity and access
2. Master data
3. Stock ledger and adjustments
4. Purchase orders
5. Goods receipts
6. Sales
7. Reports and exports
8. Quality hardening and deliverables

Slices 5 and 6 carry TOR acceptance examples AC-01 to AC-07 and are the highest-risk work.

---

## 2. How requirements are proven

### 2.1 Test layers

Each acceptance criterion below is tagged with the layer that proves it:

| Tag          | Layer                                                                                                                                              | Where                                                | Runs in                                                                    |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------- |
| `[contract]` | Zod schema tests                                                                                                                                   | `packages/contracts/src/*.test.ts`                   | `pnpm check`, CI                                                           |
| `[int]`      | API integration tests: the real Nest app against a real Postgres `erp_test` database, data reset and the §8.1 fixture loaded before **every** test | `apps/api/src/**/*.int.spec.ts` (own Vitest project) | `pnpm check` (needs the compose Postgres), CI (Postgres service container) |
| `[web]`      | React component tests with a stubbed fetch                                                                                                         | `apps/web/src/**/*.test.tsx`                         | `pnpm check`, CI                                                           |
| `[e2e]`      | Playwright against the Docker Compose stack, Chrome and Edge at 1366 × 768                                                                         | `apps/e2e`                                           | `pnpm test:e2e`, separate CI job                                           |
| `[load]`     | k6 from the `grafana/k6` image                                                                                                                     | `perf/`                                              | on demand; results saved to `docs/evidence/`                               |
| `[manual]`   | A scripted manual check with recorded evidence                                                                                                     | `docs/operations/`, `docs/evidence/`                 | before UAT readiness                                                       |
| `[review]`   | A checklist item verified in PR review                                                                                                             | PR template                                          | every PR                                                                   |

Unit specs with a stubbed Prisma (the existing `*.spec.ts` style) remain for controller and service logic, but they are **never** the proof of a stock, concurrency, idempotency or permission rule.

### 2.2 Standing checks

These run in addition to the per-criterion tests:

- **Business data** in these criteria means every table except `AuditLog`. Audit entries for refused attempts are written outside the business transaction (NFR-03), so "nothing changes" never includes the audit log.
- **Ledger invariant** (`[int]`, after every integration test): for every product and store pair, the stock balance equals the sum of its movements and is ≥ 0 (INV-03).
- **Permission matrix** (`[int]`): every route × {anonymous, `admin01`, `buyer01`, `staff_b01`, `staff_b02`, `manager01`} matches §4.2. A denied write leaves business data unchanged. A route missing from the matrix fails the test (ADR-0004).
- **Error catalogue** (`[web]`): every error code in the contract has a Thai message (ADR-0003).

### 2.3 Fixture

The §8.1 fixture is one module shared by the dev seed and the integration tests:

- **Stores:** B01 Central Store, B02 Riverside Store.
- **Supplier:** SUP01 SupplyOne Co Ltd.
- **Users:**
  - `buyer01`: Purchasing officer
  - `staff_b01`: Store employee, B01
  - `staff_b02`: Store employee, B02
  - `manager01`: Manager
  - `admin01`: Administrator. This user is added by the supplier and is not in the TOR.
- **Products:** SKU001 Drinking water pack of 6 (60.00), SKU002 Tissue paper (35.00), SKU003 Laundry detergent (120.00). Every product has a reorder threshold of 3 in both stores.
- **Stock:** B01 holds SKU001 10 and SKU002 5, each written as an `OPENING` movement. SKU003 is 0 in B01, and every B02 balance is 0. Zero balances get no movement.
- **PO-DEMO-001:** Approved, supplier SUP01, destination B01, one line of SKU001 × 20 at 45.00, nothing received yet.

Tests that need more data add it inside the test, for example a second purchasing officer `buyer02`.

### 2.4 Acceptance plan

This section is the acceptance plan required by §9.2:

- The acceptance criteria in §5 **are** the UAT case list. Each TOR example AC-01 to AC-08 keeps its TOR ID. AC-08 covers two reports, so it is split into AC-08a (RPT-01) and AC-08b (RPT-02). Each supplier-written criterion has the ID `<requirement>.<n>`.
- UAT is run by testers nominated by RetailOne in the agreed environment [C-04]. Data is reset to the §8.1 fixture before each scenario. Screen steps quote the Thai labels exactly.
- The supplier first runs every automated test and records the results in `docs/traceability.md`. This happens at the UAT readiness milestone.
- A criterion that depends on a clarification not yet `Approved` is marked **blocked** in the traceability matrix and is not used for acceptance (§7.3).
- Release acceptance requires that:
  - every in-scope criterion passes
  - no open issue is labelled `severity:blocker` (incorrect stock, duplicate posting, permission bypass or data loss)
  - the known-issue register (`docs/known-issues.md`, generated from issues labelled `known-limitation` and open `defect`s) is accepted by RetailOne

### 2.5 Technical review evidence

- Every change merges through a PR that is linked to an issue listing its requirement IDs.
- To merge, a PR needs a green CI run and one human approval. The AI review comment is supporting evidence only.
- `docs/traceability.md` lists the PRs for each requirement, so each requirement's review history can be followed.

---

## 3. Cross-cutting design

### 3.1 Data model outline

All tables use `cuid` ids. Times are stored as UTC timestamps and displayed in Asia/Bangkok. Money is `numeric(12,2)`. Quantities are integers.

| Model               | Key fields                                                                                                                                                                                                                                                     |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `User`              | `username` (unique, case-insensitive), `name`, `passwordHash`, `role` ∈ {`ADMIN`, `PURCHASING`, `STORE_STAFF`, `MANAGER`}, `storeId` (required exactly when role is `STORE_STAFF`), `active`                                                                   |
| `Store`             | `code` (unique), `name`                                                                                                                                                                                                                                        |
| `Supplier`          | `code` (unique), `name`, `contactName`, `phone`, `email`, `address`, `active`                                                                                                                                                                                  |
| `Product`           | `sku` (unique), `name`, `category` (free text), `unit` (free text), `sellingPrice`, `active`                                                                                                                                                                   |
| `StockBalance`      | (`productId`, `storeId`) unique, `quantity` (`CHECK ≥ 0`), `reorderThreshold` (≥ 0). One row per product × store, created eagerly.                                                                                                                             |
| `StockMovement`     | `productId`, `storeId`, `type` ∈ {`OPENING`, `RECEIPT`, `SALE`, `ADJUSTMENT`}, `quantityChange`, `balanceBefore`, `balanceAfter`, `sourceType`, `sourceId`, `sourceNumber`, `actorId`, `createdAt`. A trigger blocks `UPDATE` and `DELETE`.                    |
| `PurchaseOrder`     | `number`, `status`, `supplierId` + supplier code/name snapshot, `storeId` + store code/name snapshot, `expectedReceiptDate`, `createdById`, `submittedAt`, `decidedById`, `decidedAt`, `decisionNote`, `cancelledById`, `cancelledAt`, `cancelReason`, `total` |
| `PurchaseOrderLine` | `purchaseOrderId`, `productId` + SKU/name/unit snapshot, `quantityOrdered`, `unitPrice`, `lineAmount`, `quantityReceived`. Unique (`purchaseOrderId`, `productId`).                                                                                            |
| `GoodsReceipt`      | `number`, `purchaseOrderId`, `storeId`, `idempotencyKey` (unique), `requestHash`, `actorId`, `confirmedAt`                                                                                                                                                     |
| `GoodsReceiptLine`  | `goodsReceiptId`, `purchaseOrderLineId`, `productId` + snapshot, `quantity`                                                                                                                                                                                    |
| `Sale`              | `number` (null until confirmed), `status` ∈ {`DRAFT`, `CONFIRMED`}, `storeId` + snapshot, `createdById`, `confirmedById`, `confirmedAt`, `total`                                                                                                               |
| `SaleLine`          | `saleId`, `productId`, `quantity`; on confirm: SKU/name/unit snapshot, `unitPrice`, `lineAmount`. Unique (`saleId`, `productId`).                                                                                                                              |
| `StockAdjustment`   | `number`, `productId`, `storeId`, `quantityChange` (≠ 0), `reason`, `idempotencyKey` (unique), `requestHash`, `actorId`, `createdAt`                                                                                                                           |
| `DocumentSequence`  | (`type`, `year`) unique, `next`                                                                                                                                                                                                                                |
| `AuditLog`          | `action` ∈ {`PO_APPROVE`, `PO_REJECT`, `GOODS_RECEIPT`, `SALE_CONFIRM`, `STOCK_ADJUST`}, `outcome` ∈ {`SUCCESS`, `REJECTED`}, `errorCode`, `actorId`, `storeId`, `sourceType`, `sourceId`, `sourceNumber`, `createdAt`, `details` (JSON)                       |

`PO-DEMO-001` and `OPENING` movements exist only in seed and fixture data.

### 3.2 Document numbers [C-23]

Every document number has the form `<TYPE>-<YYYY>-<NNNNNN>`, for example `PO-2026-000001`.

- **Sequences:** there is one sequence per type and Bangkok calendar year. Numbers are allocated inside the posting transaction from `DocumentSequence`, so a rolled-back posting doesn't consume a number.
- **When numbers are assigned:**
  - a purchase order when its draft is created
  - a goods receipt and a stock adjustment when they are created
  - a sale when it is confirmed

### 3.3 Duplicate prevention (ADR-0002)

- **Sales:** `POST /sales/{id}/confirm` on a sale that is already `CONFIRMED` returns that sale with `replayed: true` and changes nothing.
- **Goods receipts and stock adjustments** take an `idempotencyKey` (UUID):
  - The key is stored only when the operation succeeds.
  - Sending the same key with the same content returns the original document with `replayed: true`.
  - Sending the same key with different content returns `IDEMPOTENCY_KEY_REUSED`.
- **Screens:** the screen generates a key when the form opens. It keeps the key across retries and generates a new one only after a success.

### 3.4 Concurrency and atomicity (ADR-0001)

- Each posting runs as one transaction. Inside it the server:
  1. validates against the latest database state
  2. allocates the document number
  3. writes the document
  4. updates each balance
  5. writes each movement

  Either all of this commits or none of it does.

- **Decreases** use `quantity = quantity - n WHERE quantity >= n`. A sale touches lines in ascending product id order.
- **Receipts** lock the PO row with `FOR UPDATE` before checking outstanding quantities.
- **Conflicts:** a deadlock or serialization failure returns `CONFLICT_RETRY`, kind `retry`.

### 3.5 Errors (ADR-0003)

Every error response has the shape `{ code, kind: 'correct' | 'retry', data? }`. The catalogue lives in `@erp/contracts`. The minimum set:

| Code                                        | Kind    | `data`                                    | Used by                                           |
| ------------------------------------------- | ------- | ----------------------------------------- | ------------------------------------------------- |
| `VALIDATION_FAILED`                         | correct | field paths and issues                    | all inputs                                        |
| `UNAUTHENTICATED`                           | correct | —                                         | no or expired session                             |
| `INVALID_CREDENTIALS`                       | correct | —                                         | login (doesn't reveal which field was wrong)      |
| `USER_INACTIVE`                             | correct | —                                         | login, any request by a deactivated user          |
| `FORBIDDEN`                                 | correct | —                                         | role or store not permitted                       |
| `NOT_FOUND`                                 | correct | —                                         | unknown id, or an id outside the caller's store   |
| `SKU_TAKEN`, `CODE_TAKEN`, `USERNAME_TAKEN` | correct | —                                         | master data                                       |
| `SKU_LOCKED`, `CODE_LOCKED`                 | correct | —                                         | MD-01, MD-03 [C-21]                               |
| `PRODUCT_INACTIVE`                          | correct | products                                  | PO lines, sales                                   |
| `SUPPLIER_INACTIVE`                         | correct | —                                         | PO                                                |
| `DUPLICATE_LINE`                            | correct | products                                  | PO, sale                                          |
| `PO_INCOMPLETE`                             | correct | missing fields                            | PO submit                                         |
| `EXPECTED_DATE_PAST`                        | correct | —                                         | PO submit [C-07]                                  |
| `PO_INVALID_STATUS`                         | correct | current status                            | any PO action or receipt in the wrong status      |
| `RECEIPT_EMPTY`                             | correct | —                                         | GR-02                                             |
| `RECEIPT_LINE_UNKNOWN`                      | correct | lines                                     | GR-02                                             |
| `RECEIPT_EXCEEDS_OUTSTANDING`               | correct | lines with outstanding qty                | GR-02, GR-05                                      |
| `SALE_INVALID_STATUS`                       | correct | —                                         | SAL-04                                            |
| `INSUFFICIENT_STOCK`                        | correct | products with requested and available qty | SAL-02                                            |
| `ADJUSTMENT_EXCEEDS_BALANCE`                | correct | available qty                             | INV-05                                            |
| `IDEMPOTENCY_KEY_REUSED`                    | correct | —                                         | GR-04, INV-05                                     |
| `REPORT_RANGE_TOO_LONG`                     | correct | max days                                  | RPT-01 [C-11]                                     |
| `EXPORT_TOO_LARGE`                          | correct | row count                                 | RPT-04 [C-12]                                     |
| `CONFLICT_RETRY`                            | retry   | —                                         | concurrency                                       |
| `INTERNAL_ERROR`                            | retry   | —                                         | anything unexpected; no stack, SQL or Prisma text |

The web maps each code to a Thai message. Errors of kind `correct` are shown next to the relevant field when there is one. Errors of kind `retry` offer a retry action.

### 3.6 Lists, time and money

- **Lists:** paging is by offset, with `page` and `pageSize` (default 20, at most 100). The response includes `total`.
- **Ordering:** documents and movements are newest first. The stock list is ordered by SKU [C-03].
- **Time:** all times shown in the UI are Asia/Bangkok. Report ranges are inclusive Bangkok calendar dates (`from`, `to`), turned into the half-open instant range [from 00:00, to + 1 day 00:00) in Bangkok.
- **Money in the API:** sent as strings matching `^\d+\.\d{2}$`, for example `"155.00"`.
- **Money on the server:** arithmetic is done in whole satang. Line amount = quantity × unit price, and the total is the sum of line amounts.
- **Clock:** the API reads the current time through one injectable clock, so tests can fix it.

### 3.7 Sessions and secrets

- Sessions are an HTTP-only signed cookie carrying the user id, with a lifetime of 12 hours [C-16].
- Every request reloads the user's role, store and active flag.
- `AUTH_SECRET` is required when `NODE_ENV=production`; there is no built-in default in that case. All environment variables are listed in `.env.example`.
- Request logging redacts the `password` field, the `cookie` and `set-cookie` headers, and `authorization`.

---

## 4. Slice 1 — Identity and access

### 4.1 Rules

- **Sign-in:** users sign in with a username and password [C-20]. Usernames are trimmed and case-insensitive.
- **Roles:** there are four:
  - Administrator: `ADMIN`
  - Purchasing officer: `PURCHASING`
  - Store employee: `STORE_STAFF`
  - Manager: `MANAGER`

  Each user has exactly one role. A store employee has exactly one assigned store, and every other role has none [C-18].

- **Administrators maintain users:**
  - create a user, which sets their name, username, role, assigned store and initial password
  - edit a user's name, role and store
  - reset a password
  - deactivate or reactivate a user

  Passwords are at least 8 characters long. Users cannot change their own password [C-14].

### 4.2 Permission matrix

The API enforces this matrix on every route (ADR-0004). "Own store" means the caller's assigned store. A store employee who asks for another store's data gets `FORBIDDEN`, and a single document from another store returns `NOT_FOUND`.

| Capability                                        | Admin | Purchasing            | Store employee                                    | Manager              |
| ------------------------------------------------- | ----- | --------------------- | ------------------------------------------------- | -------------------- |
| Maintain users, stores, suppliers, products       | ✔     | –                     | –                                                 | –                    |
| Read lookups (active products, suppliers, stores) | ✔     | ✔                     | ✔                                                 | ✔                    |
| Create, edit and submit PO drafts                 | –     | own POs               | –                                                 | –                    |
| Cancel a Draft or Pending Approval PO             | –     | own POs               | –                                                 | any PO               |
| View POs                                          | –     | all                   | Approved and Partially Received POs for own store | all, drafts included |
| Approve or reject PO                              | –     | –                     | –                                                 | ✔                    |
| Receive goods                                     | –     | –                     | own store                                         | –                    |
| View goods receipts                               | –     | all                   | own store                                         | all                  |
| Create, edit, delete and confirm sales            | –     | –                     | own store                                         | –                    |
| View sales                                        | –     | –                     | own store                                         | all                  |
| Stock and low-stock screen and stock CSV          | –     | all, read-only [C-01] | own store                                         | all                  |
| Daily sales report and sales CSV                  | –     | –                     | own store                                         | all                  |
| Movement history                                  | –     | –                     | own store                                         | all                  |
| Adjust stock                                      | –     | –                     | –                                                 | ✔                    |
| Audit log                                         | –     | –                     | –                                                 | ✔ [C-22]             |

Administrators have no access to any transaction, stock, report or audit route [C-17].

### 4.3 Contract

| Route                                                                                         | Notes                                                                       |
| --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `POST /auth/login`                                                                            | `{ username, password }` → user (`id`, `username`, `name`, `role`, `store`) |
| `POST /auth/logout`                                                                           |                                                                             |
| `GET /auth/me`                                                                                | session user or `null`                                                      |
| `GET /users`, `POST /users`, `PATCH /users/{id}`                                              | admin only                                                                  |
| `POST /users/{id}/reset-password`, `POST /users/{id}/deactivate`, `POST /users/{id}/activate` | admin only                                                                  |

### 4.4 Screens

- **Login** (เข้าสู่ระบบ, "Sign in").
- **User list and user form.** Admin only.
- **Navigation shows only what the role may use.** This makes the app easier to use; it does not enforce permissions.

### 4.5 Acceptance criteria

- **NFR-01.1** `[int]` Given no session, when any route other than `/auth/login`, `/auth/me` or `/health` is called, then the API returns `UNAUTHENTICATED` and returns no business data.
- **NFR-01.2** `[int]` Given the §8.1 fixture, when every route is called as each test user and as an anonymous caller, then each call is allowed or denied exactly as §4.2 says, and every denied write leaves all business data unchanged.
- **AC-04** `[int]` Given the §8.1 fixture, when `staff_b02` calls the API directly to receive 8 of SKU001 against PO-DEMO-001, then:
  - the response is `FORBIDDEN`
  - B01 SKU001 stays at 10
  - no receipt or movement exists
  - PO-DEMO-001 stays Approved
  - a `REJECTED` audit entry records the attempt
- **NFR-01.3** `[int]` Given `buyer01` is signed in, when `admin01` deactivates `buyer01`, then `buyer01`'s next request returns `USER_INACTIVE`.
- **NFR-01.4** `[int]` Given `staff_b01` is signed in, when `admin01` moves `staff_b01` to B02, then `staff_b01`'s next stock request returns B02 data only.
- **NFR-01.5** `[int]` Given a session issued 12 hours and 1 second ago (fixed clock), when it is used, then the API returns `UNAUTHENTICATED`.
- **NFR-01.6** `[e2e]` Given `staff_b01` is signed in, when the navigation renders, then it shows no purchase-order approval, adjustment, master-data or audit entries.
- **NFR-01.7** `[int]` Given the fixture, when `staff_b01` signs in with the right password, then the user and assigned store are returned. A wrong password or an unknown username both return `INVALID_CREDENTIALS`.
- **NFR-01.8** `[int]` + `[contract]` Given `admin01`:
  - creating a `STORE_STAFF` user without a store, or a non-store-staff user with a store, returns `VALIDATION_FAILED`
  - a password of 7 characters is rejected
  - a password reset lets the user sign in with the new password only

---

## 5. Acceptance criteria by slice

### 5.1 Slice 2 — Master data

**Rules:**

- Admin maintains stores, suppliers and products.
- SKUs and codes are trimmed and unique case-insensitively. A SKU is locked once any document (drafts included) or movement refers to its product. A store or supplier code is locked once any document refers to it [C-21].
- Category and unit are free text.
- Creating a product creates a stock balance row for every store, with quantity 0 and the threshold entered for that store (default 0). Creating a store creates a row for every product, with threshold 0.
- Suppliers and products can be deactivated and reactivated. Stores cannot be deactivated [C-13].

**Contract:**

- `GET|POST /stores`, `PATCH /stores/{id}`
- `GET|POST /suppliers`, `PATCH /suppliers/{id}` (including `active`)
- `GET|POST /products`, `GET|PATCH /products/{id}` (including `active` and thresholds per store)
- Lookups: `GET /products?activeOnly=true&q=` and `GET /suppliers?activeOnly=true`

**Screens:** store list and form, supplier list and form, and product list and form. The product form includes a threshold for each store.

**MD-01** (products, unique SKU, SKU locked after use)

- **MD-01.1** `[int]` Given `admin01`, when SKU004 "Dish soap" is created with category "Household", unit "bottle", price 25.00 and thresholds B01 = 3, B02 = 0, then it appears in the product list and both stores show stock 0 with those thresholds.
- **MD-01.2** `[int]` When a product is created with SKU `sku001`, then the response is `SKU_TAKEN`.
- **MD-01.3** `[int]` Changing the SKU of SKU003, which no document or movement refers to, succeeds. Changing the SKU of SKU001, which PO-DEMO-001 and its opening movement refer to, returns `SKU_LOCKED`. Every other field of SKU001 stays editable.

**MD-02** (non-negative values, whole quantities, deactivation)

- **MD-02.1** `[contract]` A selling price of `-0.01` or `1.005` and a threshold of `-1` or `2.5` are rejected.
- **MD-02.2** `[int]` Given SKU002 is deactivated:
  - it no longer appears in active lookups
  - it stays in the stock list when "include inactive" is on, in movement history, and on existing documents
  - adding it to a new PO draft or a sale draft returns `PRODUCT_INACTIVE`
- **MD-02.3** `[int]` Given a PO draft and a sale draft that each contain SKU002, when SKU002 is deactivated and the PO is submitted or the sale confirmed, then each returns `PRODUCT_INACTIVE` naming SKU002 and nothing changes.
- **MD-02.4** `[contract]` Every quantity in every input schema is an integer.

**MD-03** (stores, suppliers, one supplier and one store per PO)

- **MD-03.1** `[int]` When `admin01` creates store B03 "Hilltop Store", then every product has a B03 stock row with quantity 0 and threshold 0. No route exists to deactivate a store.
- **MD-03.2** `[int]` Changing B01's code or SUP01's code returns `CODE_LOCKED`, because PO-DEMO-001 refers to them. Renaming them succeeds, and PO-DEMO-001 still shows the old names (SHR-02).
- **MD-03.3** `[int]` A supplier can be created and edited with its contact name, phone, email and address. When SUP01 is deactivated, then a new PO draft with SUP01 returns `SUPPLIER_INACTIVE`, and PO-DEMO-001 can still be received.
- **MD-03.4** `[contract]` The PO input accepts exactly one `supplierId` and one `storeId`.

### 5.2 Slice 3 — Stock ledger and adjustments

**Contract:**

- `GET /stock?q=&storeId=&lowOnly=&includeInactive=&page=` (INV-01 and RPT-02)
- `GET /stock/export.csv`
- `GET /stock-movements?productId=&storeId=&type=&from=&to=&page=`
- `POST /stock-adjustments { productId, storeId, quantityChange, reason, idempotencyKey }`
- `GET /stock-adjustments/{id}`

**Screens:**

- the stock screen, which shows stock on hand and has a low-stock filter
- movement history
- the stock adjustment form, for managers

**INV-01** (search stock, show low-stock status)

- **INV-01.1** `[int]` When `staff_b01` searches B01 with `q=SKU00`, then the result is:

  | SKU    | Quantity | Unit | Threshold | Low stock |
  | ------ | -------- | ---- | --------- | --------- |
  | SKU001 | 10       | pack | 3         | no        |
  | SKU002 | 5        | pack | 3         | no        |
  | SKU003 | 0        | bag  | 3         | yes       |

- **INV-01.2** `[int]` A search matches a substring of the SKU or name, case-insensitively, in English and Thai.
- **INV-01.3** `[int]` Given SKU002 in B01 is adjusted to 3, its low-stock flag is yes (the comparison is ≤, not <).
- **INV-01.4** `[e2e]` `staff_b01` can search for stock with the keyboard alone and sees the low-stock badge on SKU003.

**INV-02** (every change recorded, movements immutable)

- **INV-02.1** `[int]` After AC-01, exactly one movement exists for that receipt, with:
  - product SKU001 and store B01
  - change +8, balance before 10, balance after 18
  - type `RECEIPT`
  - its source being the receipt's `GR-` number and id
  - actor `staff_b01` and a timestamp
- **INV-02.2** `[int]` The API offers no route to update or delete movements. A direct SQL `UPDATE` or `DELETE` on a movement fails.

**INV-03** (balance = opening + movements, never negative, all or nothing)

- **INV-03.1** `[int]` The ledger invariant (§2.2) holds after every integration test.
- **INV-03.2** `[int]` Given the movement write is forced to fail after the stock update (a test provider override), when staff_b01 receives 8 against PO-DEMO-001, then:
  - the response is `INTERNAL_ERROR`
  - no receipt or movement exists
  - B01 SKU001 stays at 10
  - PO-DEMO-001 stays Approved with 0 received
- **INV-03.3** `[int]` A direct SQL update that sets a balance to −1 is rejected by the database.

**INV-04** (no lost updates under concurrency)

- **AC-07** `[int]` Given B01 SKU001 at 10, when two sale drafts of 7 each are confirmed concurrently, then exactly one succeeds, the other returns `INSUFFICIENT_STOCK`, and the final stock is 3 with one `SALE` movement.
- **INV-04.1** `[int]` Given B01 SKU001 at 10, when a receipt of 8 and a sale of 7 run concurrently, then both succeed and the final stock is 11. The two movements' before and after balances chain without a gap.

**INV-05** (manager adjustments)

- **INV-05.1** `[int]` When `manager01` adjusts B01 SKU001 by −4 with the reason "แตกเสียหาย" ("broken/damaged"), then:
  - stock becomes 6
  - an `ADJ-2026-…` document exists
  - one `ADJUSTMENT` movement records −4, 10 → 6
  - a `SUCCESS` audit entry is written
- **INV-05.2** `[int]` An adjustment of −11 returns `ADJUSTMENT_EXCEEDS_BALANCE` with available 10. Nothing changes, and a `REJECTED` audit entry is written.
- **INV-05.3** `[contract]` A missing or blank reason, a quantity of 0, or a fractional quantity is rejected.
- **INV-05.4** `[int]` Resending INV-05.1 with the same idempotency key returns the same `ADJ-` document with `replayed: true`, and stock stays at 6.
- **INV-05.5** `[int]` An adjustment of +5 on B02 SKU003 makes that stock 5.

**SHR-01** (unique document numbers)

- **SHR-01.1** `[int]` Five sales confirmed concurrently get five distinct consecutive `SO-2026-` numbers. A unique constraint on each document table rejects a duplicate number.
- **SHR-01.2** `[int]` With the clock fixed at 2027-01-01 00:00 Bangkok time, the next PO number is `PO-2027-000001`.

**SHR-02** (snapshots)

- **SHR-02.1** `[int]` After AC-06, `admin01` renames SKU001 and changes its price to 65.00. The confirmed sale still shows "Drinking water pack of 6", 60.00, and a total of 155.00.

**SHR-03** (money)

- **SHR-03.1** `[contract]` Money strings with 0, 1 or 3 decimals are rejected, and a string with 2 decimals is accepted.
- **SHR-03.2** `[int]` PO-DEMO-001's total is `"900.00"`, from 20 × 45.00. The sale in AC-06 totals `"155.00"`.

### 5.3 Slice 4 — Purchase orders

**Rules:**

- **Drafts:**
  - A draft can be saved incomplete, but it needs a supplier and a store from the start.
  - Only the creator can edit, submit or cancel their own draft. Managers can cancel any draft but cannot edit it.
- **Submitting:** the full PO-01 rules are checked:
  - expected date today or later [C-07]
  - at least one line
  - quantities positive integers and prices ≥ 0
  - products and supplier active
  - no duplicate SKU
- **Pending Approval** can only be approved, rejected or cancelled. It never goes back to Draft.
- **Deciding:**
  - Rejecting needs a reason. Approving takes an optional note.
  - A product deactivated after submit doesn't block approval [C-02].
- **Snapshots:** supplier code and name and store code and name go on the PO header. SKU, name and unit go on each line.

**Status transitions** (any other transition returns `PO_INVALID_STATUS`):

| From                         | Action          | To                              | Who                                     |
| ---------------------------- | --------------- | ------------------------------- | --------------------------------------- |
| —                            | create          | Draft                           | Purchasing officer                      |
| Draft                        | edit            | Draft                           | creator                                 |
| Draft                        | submit          | Pending Approval                | creator                                 |
| Pending Approval             | approve         | Approved                        | Manager                                 |
| Pending Approval             | reject (reason) | Rejected                        | Manager                                 |
| Draft, Pending Approval      | cancel (reason) | Cancelled                       | creator or Manager                      |
| Approved, Partially Received | goods receipt   | Partially Received or Completed | Store employee of the destination store |

**Contract:**

- `GET /purchase-orders?status=&storeId=&supplierId=&page=`, `GET /purchase-orders/{id}`
- `POST /purchase-orders`, `PATCH /purchase-orders/{id}`
- `POST /purchase-orders/{id}/submit|approve|reject|cancel`

**Screens:**

- the PO list, with filters
- the PO form for drafts
- the PO detail page, with actions by role and status
- the manager's approval queue, which is the list filtered to Pending Approval

**PO-01** (create drafts, line rules)

- **PO-01.1** `[int]` When `buyer01` creates a draft with SUP01, B01, an expected date of tomorrow and one line of SKU002 × 10 at 20.00, then:
  - the PO is a Draft with a `PO-2026-` number and a total of 200.00
  - B01 SKU002 stays at 5
  - no movement exists
- **PO-01.2** `[contract]` Line quantities of 0, −1 or 1.5 and a price of −0.01 are rejected.
- **PO-01.3** `[int]` Two lines for SKU002 in the same PO return `DUPLICATE_LINE`.
- **PO-01.4** `[int]` Submitting a draft with no lines or no expected date returns `PO_INCOMPLETE`, which lists the missing fields.

**PO-02** (statuses, no stock effect)

- **PO-02.1** `[contract]` The status enum is exactly Draft, Pending Approval, Approved, Partially Received, Completed, Rejected and Cancelled.
- **PO-02.2** `[int]` Creating, submitting and approving a PO changes no balance and writes no movement.
- **PO-02.3** `[int]` Every transition that is not in the table above returns `PO_INVALID_STATUS`. A test is generated per status × action.

**PO-03** (edit, submit, approve or reject, lock after approval)

- **PO-03.1** `[int]` `buyer01` can edit their draft. Another purchasing officer, `buyer02`, gets `FORBIDDEN`. `manager01` gets `FORBIDDEN` when editing.
- **PO-03.2** `[int]` A valid submit moves the PO to Pending Approval. A later edit returns `PO_INVALID_STATUS`.
- **PO-03.3** `[int]` When `manager01` approves it, the PO becomes Approved with the approver and time recorded, and a `SUCCESS` audit entry is written.
- **PO-03.4** `[int]` Rejecting without a reason returns `VALIDATION_FAILED`. Rejecting with a reason makes the PO Rejected and writes an audit entry. The rejected PO stays viewable, and editing or resubmitting it returns `PO_INVALID_STATUS`.
- **PO-03.5** `[int]` Changing lines, quantities, prices or the store of PO-DEMO-001 returns `PO_INVALID_STATUS`.
- **PO-03.6** `[int]` `buyer01` approving a PO returns `FORBIDDEN`.
- **PO-03.7** `[int]` Submitting with an expected date of yesterday (Bangkok time, fixed clock) returns `EXPECTED_DATE_PAST`. With a date of today, submit succeeds.
- **PO-03.8** `[int]` Given a Pending Approval PO containing SKU002, when SKU002 is deactivated and `manager01` approves the PO, then the approval succeeds [C-02].

**PO-04** (cancel Draft or Pending only)

- **PO-04.1** `[int]` `buyer01` cancels their own draft with a reason, and the PO becomes Cancelled with the reason, actor and time recorded.
- **PO-04.2** `[int]` `manager01` cancels a Pending Approval PO with a reason, and it becomes Cancelled.
- **PO-04.3** `[int]` Cancelling PO-DEMO-001, which is Approved, returns `PO_INVALID_STATUS`.
- **PO-04.4** `[int]` `buyer02` cancelling `buyer01`'s draft returns `FORBIDDEN`.
- **PO-04.5** `[contract]` A cancellation without a reason is rejected.

### 5.4 Slice 5 — Goods receipts

**Rules:**

- **Who can receive:** a store employee, against an Approved or Partially Received PO whose destination is their own store.
- **Lines:** every line of the receipt references a line of that PO. The receipt cannot add products.
- **Quantities:** each quantity is an integer ≥ 0, at least one must be > 0, and each must be ≤ the line's outstanding quantity. Outstanding quantity is checked after the PO row is locked.
- **On confirm:**
  - the receipt gets its `GR-` number
  - destination stock increases
  - one `RECEIPT` movement is written per line with quantity > 0
  - the line received quantities update
  - the PO status updates: Partially Received if anything is still outstanding, Completed otherwise
  - an audit entry is written
- **Duplicates:** prevented by the idempotency key (§3.3).
- **Deactivated products:** a product deactivated after the PO was approved can still be received [Q-02].
- **After confirmation:** receipts cannot be edited, cancelled or reversed.

**Contract:**

- `GET /purchase-orders/{id}/receiving`: each line's ordered, previously received and outstanding quantities
- `POST /goods-receipts { purchaseOrderId, idempotencyKey, lines: [{ purchaseOrderLineId, quantity }] }`
- `GET /goods-receipts?purchaseOrderId=&storeId=&page=`
- `GET /goods-receipts/{id}`

**Screens:**

- the list of POs ready to receive for the user's store
- the receiving form, which shows ordered, received and outstanding quantities per line
- the receipt detail page, which links to its PO and movements

**GR-01** (who and which POs; receiving view)

- **GR-01.1** `[int]` `staff_b01` opens receiving for PO-DEMO-001 and sees SKU001 ordered 20, received 0, outstanding 20. After AC-01 the same view shows 20 / 8 / 12.
- **GR-01.2** `[int]` Receiving against a Draft, Pending Approval, Rejected, Cancelled or Completed PO returns `PO_INVALID_STATUS`.
- **AC-04**: see §4.5.

**GR-02** (partial receipts, quantity rules, no extra products)

- **AC-03** `[int]` Receiving 21 of SKU001 against PO-DEMO-001 returns `RECEIPT_EXCEEDS_OUTSTANDING`. No receipt or movement is created, stock stays at 10, and the status stays Approved.
- **GR-02.1** `[contract]` A line quantity of −1 or 1.5 is rejected. `[int]` All lines at 0 returns `RECEIPT_EMPTY`.
- **GR-02.2** `[int]` A line whose `purchaseOrderLineId` belongs to another PO, or is unknown, returns `RECEIPT_LINE_UNKNOWN`.
- **GR-02.3** `[int]` After receiving 8, receiving 13 returns `RECEIPT_EXCEEDS_OUTSTANDING` with outstanding 12.

**GR-03** (confirmation effects and status)

- **AC-01** `[int]` + `[e2e]` When `staff_b01` receives 8 of SKU001 against PO-DEMO-001, then:
  - B01 SKU001 becomes 18
  - outstanding becomes 12
  - the status becomes Partially Received
  - exactly one receipt and one `RECEIPT` movement exist
- **GR-03.1** `[int]` Receiving 8 and then 12 (TOR business example) leaves stock at 30 and the PO Completed, with two receipts and two movements.
- **GR-03.2** `[int]` The receipt number matches `GR-2026-\d{6}`. Its confirmation time is the server's clock, not a value from the client [Q-03].

**GR-04** (duplicates return the original; a new receipt is still possible)

- **AC-02** `[int]` After a successful receipt of 8, the identical request is sent again with the same idempotency key. It returns the original receipt with `replayed: true`. Stock stays at 18 and the cumulative received quantity stays at 8 [C-06].
- **GR-04.1** `[int]` The same key with a quantity of 7 instead of 8 returns `IDEMPOTENCY_KEY_REUSED`, and nothing changes.
- **GR-04.2** `[int]` After AC-01, a receipt of 8 with a new key succeeds as a second receipt. Stock becomes 26 and the received quantity 16.
- **GR-04.3** `[int]` A key whose first attempt was rejected (quantity 21) is reused with quantity 8, and the receipt succeeds.
- **GR-04.4** `[int]` Two concurrent requests with the same key and content produce one receipt. Both responses carry the same receipt number.
- **GR-04.5** `[e2e]` Double-clicking "ยืนยันการรับสินค้า" ("Confirm goods receipt") produces one receipt.
- **GR-04.6** `[web]` The receiving form sends the same key on a retry after a network error and generates a new key after a success.

**GR-05** (concurrent receipts never exceed the order; receipts are immutable)

- **GR-05.1** `[int]` Two concurrent receipts of 15 each against PO-DEMO-001, with different keys: exactly one succeeds and the other returns `RECEIPT_EXCEEDS_OUTSTANDING`. The received quantity is 15 and stock is 25.
- **GR-05.2** `[int]` No route updates, cancels or reverses a receipt. The receipt from AC-01 can be viewed by `staff_b01`, `buyer01` and `manager01`, and `staff_b02` gets `NOT_FOUND` for it.

**Q-02** (pending RetailOne; excluded from acceptance until approved)

- **Q-02.1** `[int]` Given PO-DEMO-001 is Approved, when SKU001 is deactivated and `staff_b01` receives 8, then the receipt succeeds as in AC-01.

### 5.5 Slice 6 — Sales

**Rules:**

- **Drafts:**
  - A sale draft belongs to one store. Any store employee of that store can edit, delete or confirm it [C-09].
  - Drafts have no number and no stock effect.
- **Lines:** products must be active, quantities positive integers, and SKUs unique within a sale. Adding the same product again increases that line's quantity.
- **Price:** the price is never sent by the client. The draft shows the current selling price. On confirm, the price and total are snapshotted [C-08].
- **Confirming:** confirmation checks every line against the latest stock and active status. If any line fails, the whole sale is rejected with every failing product listed, and nothing is posted. On success:
  - the sale gets its `SO-` number and confirmation time
  - one `SALE` movement is written per line
  - an audit entry is written
- **After confirmation:** a confirmed sale cannot be edited, deleted, cancelled or returned. No customer data and no payment data are kept.

**Contract:**

- `GET /sales?storeId=&status=&from=&to=&page=`, `GET /sales/{id}`
- `POST /sales { storeId, lines: [{ productId, quantity }] }`
- `PATCH /sales/{id}`, `DELETE /sales/{id}` (drafts only)
- `POST /sales/{id}/confirm`

**Screens:** the sales list, the sale form (a draft with live prices and total), and the sale detail page.

**SAL-01** (store, active products, positive quantities, current price, no override)

- **SAL-01.1** `[int]` `staff_b01` creates a B01 draft with SKU001 × 2. It is a Draft with no number, it shows the unit price 60.00 and a line amount of 120.00, and stock stays at 10.
- **SAL-01.2** `[contract]` The sale line schema is strict, so a `unitPrice` field is rejected.
- **SAL-01.3** `[int]` `staff_b01` creating a draft for B02 returns `FORBIDDEN`.
- **SAL-01.4** `[int]` Adding inactive SKU002 returns `PRODUCT_INACTIVE`.
- **SAL-01.5** `[contract]` A quantity of 0 or 1.5 is rejected. `[int]` A duplicate product in one sale returns `DUPLICATE_LINE`.
- **SAL-01.6** `[int]` A draft with SKU001 × 1 is created while the price is 60.00. `admin01` then sets the price to 65.00, and the sale is confirmed. The confirmed line is 65.00 and the total 65.00 [C-08].

**SAL-02** (drafts don't reduce stock; all-or-nothing stock check)

- **AC-05** `[int]` Confirming a sale of SKU001 × 11 with stock at 10 returns `INSUFFICIENT_STOCK` (SKU001: requested 11, available 10). The sale stays a draft, and there is no stock change or movement.
- **SAL-02.1** `[int]` Confirming SKU001 × 2 + SKU003 × 1 returns `INSUFFICIENT_STOCK`, which lists only SKU003 (available 0). SKU001 stays at 10, and no `SALE` movement exists.
- **SAL-02.2** `[int]` Creating and editing drafts never changes any balance.
- **SAL-02.3** `[int]` A rejected confirmation writes a `REJECTED` audit entry with `INSUFFICIENT_STOCK`.

**SAL-03** (one transaction; duplicate confirmation has no effect)

- **AC-06** `[int]` + `[e2e]` A sale of SKU001 × 2 + SKU002 × 1 is confirmed. It totals 155.00, has an `SO-2026-` number, and B01 balances become 8 and 4, with two `SALE` movements. Calling confirm again returns the same sale with `replayed: true`, and nothing else changes [C-06].
- **SAL-03.1** `[int]` Two concurrent confirm calls on the same draft produce one confirmed sale and one deduction per line.

**SAL-04** (confirmed sales are read-only; no payments or customers)

- **SAL-04.1** `[int]` `PATCH` or `DELETE` on a confirmed sale returns `SALE_INVALID_STATUS`. No cancel or return route exists.
- **SAL-04.2** `[contract]` The sale schemas have no customer or payment fields.
- **SAL-04.3** `[int]` Deleting a draft removes it, and the next confirmed sale's number is not skipped [C-09].

### 5.6 Slice 7 — Reports and exports

**Contract:**

- `GET /reports/daily-sales?from=&to=&storeId=`
- `GET /reports/daily-sales/export.csv`
- `GET /stock/export.csv` (same filters as `GET /stock`)
- `GET /stock-movements` (see §5.2)
- `GET /audit-log?action=&outcome=&from=&to=&page=` (manager only)

**Screens:**

- the daily sales report
- stock on hand and low stock, which is the stock screen from §5.2
- movement history
- the audit log, for managers

**RPT-01** (daily sales report)

- **AC-08a** `[int]` + `[web]` With no sales on the selected day, the report shows a document count of 0, units 0 and total 0.00, plus the empty-state message.
- **RPT-01.1** `[int]` With the clock at 2026-11-02 10:00 Bangkok time, AC-06 is confirmed. The B01 report for 2026-11-02 shows 1 document, 3 units and 155.00.
- **RPT-01.2** `[int]` A sale confirmed at 2026-11-02 23:59:59 Bangkok time counts on the 2nd. One confirmed at 2026-11-03 00:00:00 counts on the 3rd.
- **RPT-01.3** `[int]` Drafts and rejected confirmations never appear in the report.
- **RPT-01.4** `[int]` A range of 93 days returns `REPORT_RANGE_TOO_LONG` [C-11].
- **RPT-01.5** `[int]` `staff_b01` asking for B02 gets `FORBIDDEN`. Without a store filter, `staff_b01` gets B01 only, and `manager01` gets one row per store per day.
- **RPT-01.6** `[int]` A range of 3 days with sales on 1 day returns 3 rows per store, two of them zeros, plus a totals row [C-11].

**RPT-02** (stock on hand and low stock)

- **AC-08b** `[int]` SKU003 appears in the B01 low-stock report, because its balance of 0 is ≤ its threshold of 3.
- **RPT-02.1** `[int]` The B02 stock report lists all three products with quantity 0.
- **RPT-02.2** `[int]` Inactive products are hidden unless `includeInactive=true`.

**RPT-03** (movement history)

- **RPT-03.1** `[int]` Filtering by product, store, type and date range returns only matching movements, newest first. Each movement carries its source type, number and id.
- **RPT-03.2** `[int]` `staff_b01` sees B01 movements only. Asking for B02 returns `FORBIDDEN`. `manager01` sees both stores.
- **RPT-03.3** `[e2e]` Clicking a movement's source number opens that receipt, sale or adjustment.

**RPT-04** (CSV with Thai text, same filters and permissions, formula-safe)

- **RPT-04.1** `[int]` The sales CSV for a filter has the same rows and totals as the screen. It starts with the bytes `EF BB BF`, uses CRLF line endings, and keeps Thai text intact. Money has 2 decimals and times are `YYYY-MM-DD HH:mm:ss` in Bangkok time.
- **RPT-04.2** `[int]` The stock CSV follows the same rules as RPT-04.1, for the stock screen's filters.
- **RPT-04.3** `[int]` A product named `=SUM(A1)` is exported as `'=SUM(A1)`. The same happens for values starting with `+`, `-`, `@`, a tab or a CR.
- **RPT-04.4** `[int]` `staff_b01` exporting B02 gets `FORBIDDEN`.
- **RPT-04.5** `[int]` An export that would exceed 50,000 rows returns `EXPORT_TOO_LARGE` [C-12].
- **RPT-04.6** `[manual]` The sales and stock CSVs open in Excel on Windows with Thai text readable.

**UI-01** (reporting day, zeros, empty state, two decimals)

- **UI-01.1** RPT-01.2 and AC-08a above prove the day boundary and the zero totals.
- **UI-01.2** `[web]` Each report and list screen shows its empty-state message when there are no rows. Every money value on screen is formatted with 2 decimals.

**UI-02** (pagination, newest first, states, actionable errors)

- **UI-02.1** `[int]` Lists return `pageSize` 20 by default and refuse more than 100.
- **UI-02.2** `[int]` PO, receipt, sale, adjustment, movement and audit lists are newest first. The stock list is ordered by SKU [C-03].
- **UI-02.3** `[web]` Each data screen renders its loading, success and error states.
- **UI-02.4** `[web]` A `correct` error shows its message by the field and has no retry button. A `retry` error shows a retry action.

### 5.7 Slice 8 — Quality and deliverables

**NFR-02** (no readable passwords; no secrets in logs; test data; separate config)

- **NFR-02.1** `[int]` A stored password is a hash, not the password, and verifying it against the password succeeds.
- **NFR-02.2** `[int]` Logs captured during a successful login, a failed login and a failing request contain no password, no session cookie value and no `AUTH_SECRET`.
- **NFR-02.3** `[contract]`/unit `validateEnv` with `NODE_ENV=production` and no `AUTH_SECRET` throws.
- **NFR-02.4** `[review]` `.env` is not tracked, `.env.example` lists every variable, and seed data is fictitious.

**NFR-03** (audit)

- **NFR-03.1** `[int]` For each of approve, reject, goods receipt, sale confirm and stock adjustment, a success writes one `SUCCESS` entry with the actor, time, source type, number and id. A refusal (for example AC-03, AC-05 or INV-05.2) writes one `REJECTED` entry with the error code, even though the business transaction rolled back.
- **NFR-03.2** `[int]` Only `manager01` can read `/audit-log`. Everyone else gets `FORBIDDEN`.

**NFR-04** (validation in the UI and the API; Thai messages; no leaks)

- **NFR-04.1** `[review]` Web forms validate with the same Zod schemas from `@erp/contracts` that the API uses.
- **NFR-04.2** `[int]` Invalid input returns `VALIDATION_FAILED` with field paths and kind `correct`.
- **NFR-04.3** `[int]` With Prisma forced to throw, the response is `INTERNAL_ERROR` with kind `retry`. The body contains no stack trace, SQL, table name or Prisma text.
- **NFR-04.4** `[web]` Every code in the error catalogue has a Thai message.

**NFR-05** (performance)

- **NFR-05.1** `[load]` In the agreed environment [C-04], with `pnpm db:seed:perf` (1,000 products and 10,000 movements across B01 and B02), 10 virtual users run for 5 minutes with 1 s think time. The mix is product search, stock search and view, the stock report and movement-history search. Each endpoint has p95 ≤ 2,000 ms and an error rate below 1 %. The k6 summary and the machine specification are saved to `docs/evidence/`.

**NFR-06** (browsers, 1366 px, labels, keyboard)

- **NFR-06.1** `[e2e]` The suite runs on Chromium and the `msedge` channel at 1366 × 768. The browser versions are recorded per run [C-05].
- **NFR-06.2** `[e2e]` These core flows are completed with the keyboard only:
  - sign in
  - create and submit a PO
  - approve a PO
  - receive goods
  - create and confirm a sale
  - adjust stock
- **NFR-06.3** `[e2e]` Every form field is found with `getByLabel`, and an axe-core scan of each core screen reports no missing-label violations.
- **NFR-06.4** `[e2e]` No core screen scrolls horizontally at 1366 px.

**DEL-01** (delivery package)

- **DEL-01.1** `[review]` The README and `docs/` contain:
  - install, startup and test commands
  - `.env.example`
  - migrations and seed data
  - test accounts and their passwords
  - the generated OpenAPI documentation
  - `docs/known-issues.md`
  - operating instructions (`docs/operations/user-guide.md`)

**DEL-02** (deployment, rollback, backup and restore)

- **DEL-02.1** `[manual]` `docs/operations/` contains the deployment and rollback procedure for the Docker Compose stack, plus `pg_dump` and `pg_restore` scripts. The procedure is demonstrated end to end: back up, change data, restore, then verify that the data matches the backup and that the ledger invariant holds. The run is recorded in `docs/evidence/`. Who operates it in production is decided by RetailOne [C-24].

---

## 6. Open items blocking acceptance

Acceptance cannot rely on any criterion that depends on a register entry that isn't `Approved`. At version 0.1 that is every `C-xx` entry and Q-02. The Requirements baseline milestone (§9.2) is reached once RetailOne has approved or amended them and approved this spec.
