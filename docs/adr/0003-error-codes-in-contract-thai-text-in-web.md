---
status: proposed
---

# The API returns error codes; the web turns them into Thai

Every business or validation failure is returned as a stable `code` from a catalogue in `@erp/contracts`, a `kind` of `correct` (the user must change their input) or `retry` (try the same thing again later), and typed `data` the message needs, such as the products short of stock (SAL-02) or the lines over their outstanding quantity (GR-02). The web holds the only Thai message catalogue and maps each code to text. We chose this over Thai text from the API because the contract stays language-neutral and testable by code, the web can place messages next to the right fields, and the `kind` gives every screen the "correct or retry" guidance §6.2 requires without per-screen logic.

## Consequences

- No stack traces, SQL or Prisma messages ever reach the client (NFR-04). Unknown failures become `INTERNAL_ERROR`, kind `retry`.
- A web test iterates the whole catalogue and fails if any code lacks a Thai message.
- There is no language switch and no i18n framework; if a second language is ever needed, it is a second catalogue in the web.
