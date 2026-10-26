# Extra root certificates

Behind a corporate proxy that inspects HTTPS (Zscaler, etc.), `docker compose build`
and `pnpm install` fail with `UNABLE_TO_GET_ISSUER_CERT_LOCALLY`.

Put the proxy's root CA here as a PEM file ending in `.crt`, then rebuild:
`docker compose build`. `*.crt` files are git-ignored.
