---
status: proposed
---

# Permissions are declared on every route and tested as one route-by-user matrix

NFR-01 requires role and store permissions on every API request, and a permission bypass blocks acceptance (§7.3). Each route declares the roles allowed and, for store-scoped data, how to find the store the request touches; a guard enforces both before the handler runs, and handlers additionally filter list queries to the caller's assigned store. The session token carries only the user id, so the guard loads the user's role, assigned store and active flag from the database on every request: deactivation or a role change takes effect on the next request.

The same declarations feed a single integration test that calls every route as each test user (`admin01`, `buyer01`, `staff_b01`, `staff_b02`, `manager01`) and as an anonymous caller, and checks allowed or denied against the matrix in the release 1 spec. Every denied write also checks that no business data changed (the audit log, which records the refused attempt, is not business data). A route without a matrix row fails the test, so a new route cannot ship unchecked.

## Considered options

- **Checks inside each handler**: easy to forget on one route, and there is no single place to test from.
- **Role claims in the token**: saves a query per request, but a deactivated user or changed role would keep old rights until the token expires.
