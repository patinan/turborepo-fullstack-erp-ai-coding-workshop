# Retail ERP

The business language of RetailOne's Retail ERP: one organization, one currency (THB), a head office and stores, connecting purchasing, receiving, sales and stock.

## Organization and people

**Store**:
A physical shop that sells goods and is also the only kind of stock location. Identified by a store code such as `B01`.
_Avoid_: Branch, warehouse, location

**Supplier**:
A company RetailOne buys goods from. Identified by a supplier code such as `SUP01`.
_Avoid_: Vendor

**Administrator**:
The role that maintains users, stores, suppliers and products. Has no rights over purchase orders, receipts, sales, stock or reports.
_Avoid_: Admin user, superuser

**Purchasing officer**:
The role that creates and submits purchase orders and follows their receiving status.
_Avoid_: Buyer (except in test user names such as `buyer01`)

**Store employee**:
The role that views stock, receives goods and records sales for exactly one assigned store.
_Avoid_: Staff, cashier, clerk

**Manager**:
The role that approves or rejects purchase orders, adjusts stock and sees every store.
_Avoid_: Approver, supervisor

**Assigned store**:
The single store a store employee works in. Other roles have none.

## Products and stock

**Product**:
A thing RetailOne buys and sells, identified by a SKU, counted in one base unit.
_Avoid_: Item, article, goods (as a noun for one product)

**SKU**:
The organization-wide unique code of a product. Locked once any document or stock movement refers to the product.
_Avoid_: Product code, item code

**Unit**:
The single base unit a product is counted, bought and sold in, such as pack or bag.
_Avoid_: UOM

**Active / inactive**:
Whether a product or supplier may be put on a new document. Inactive records stay visible in history.
_Avoid_: Deleted, archived, disabled

**Stock balance**:
The whole-number quantity of one product held in one store right now. Never negative.
_Avoid_: Inventory level, on-hand count

**Reorder threshold**:
A per-product, per-store quantity at or below which the product is low stock in that store.
_Avoid_: Minimum stock, reorder point, safety stock

**Low stock**:
A product whose stock balance in a store is less than or equal to its reorder threshold there.

**Stock movement**:
One recorded change to a stock balance, with its type, source document, actor and the balance before and after. Never edited or deleted.
_Avoid_: Transaction, stock log, inventory entry

**Opening balance**:
The stock a store held for a product before any other movement, recorded as an opening movement.

**Stock adjustment**:
A manager's correction of one product's stock balance in one store, with a mandatory reason.
_Avoid_: Stock correction, write-off, stock count

## Documents

**Document**:
A numbered business record that can be the source of stock movements: purchase order, goods receipt, sale or stock adjustment.

**Document number**:
The unique, human-readable identifier of a document, such as `GR-2026-000001`.
_Avoid_: Reference, ID

**Snapshot**:
The names, codes and prices copied onto a document at the moment they apply, so later master-data changes don't alter history.

**Draft**:
A purchase order or sale that has been saved but has no business effect yet.

**Confirm**:
The moment a sale or goods receipt takes effect: it gets its document number, changes stock and can no longer be edited.
_Avoid_: Post, commit, finalize

**Purchase order (PO)**:
A request to one supplier for goods delivered to one destination store.
_Avoid_: Order (alone), requisition

**Ordered / received / outstanding quantity**:
For a PO line: the quantity requested, the quantity confirmed on goods receipts so far, and the difference.

**Goods receipt (GR)**:
A confirmed record of goods delivered against one PO into its destination store.
_Avoid_: Delivery, GRN, receiving note

**Sale**:
A record of products sold from one store at their current selling prices.
_Avoid_: Order, invoice, receipt, transaction

**Selling price**:
A product's current price to customers, in baht with two decimals. Copied onto a sale when it is confirmed.
_Avoid_: Retail price, list price

**Purchase unit price**:
The price per unit agreed with the supplier on a PO line.
_Avoid_: Cost, purchase cost

## Reporting

**Reporting day**:
A calendar day in Asia/Bangkok, from 00:00:00 inclusive to the next day's 00:00:00 exclusive. A sale belongs to the reporting day of its confirmation.
_Avoid_: Business day, trading day

## Engagement

**Requirements baseline**:
The set of TOR requirements, clarifications and acceptance criteria that release acceptance is measured against.

**Clarification**:
A recorded business decision on a question the TOR leaves open, with its approving stakeholder and affected requirements.

**Change request (CR)**:
A proposal to change the requirements baseline, which takes effect only after written approval.
