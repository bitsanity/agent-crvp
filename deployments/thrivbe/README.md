# Thrivbe Deployment Adapter

This directory contains deployment-specific, non-secret files for the
Thrivbe CARP interface. It keeps the shared CARP core free of Thrivbe's
runtime configuration.

For the phase-one encrypted async test, deploy the shared CGI files
`acl.js`, `answers.js`, `worker.js`, `obrequest`, `encresult`, and
`nextanswer` together with this directory's `cgi-bin/env.js`.

The running container supplies `CARP_PRIVKEY_HEX` through its existing
environment. Do not commit `.env`, private keys, Telegram credentials,
or answer/request payloads.
