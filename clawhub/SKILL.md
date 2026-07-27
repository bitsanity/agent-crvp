---
name: carp
description: Manage a local CARP interface for ADILOS trust setup, queue polling, encrypted agent-to-agent requests, menus, results, answers, and secure commerce/escrow workflows through local or LAN CARP endpoints.
metadata:
  {
    "openclaw":
      {
        "requires":
          {
            "bins": ["curl"],
            "env": ["IF_URL"],
          },
      },
  }
---

# CARP

CARP is Crustacean Agent Rendezvous Protocol (CARP).

Reference implementation and source code:

- https://github.com/bitsanity/agent-crvp

## Configuration

Use CARP through one config value:

- `IF_URL`: Base URL for the local CARP interface (`http://host:port`). In Bryan's OpenClaw workspace, use `http://127.0.0.1:8888` unless a newer local note overrides it. Prefer this exact loopback form over `localhost`; use a LAN host only when intentionally reaching another trusted interface.

Set once per shell:

```bash
export IF_URL="http://127.0.0.1:8888"
```

Before acting, confirm the local interface is reachable:

```bash
curl -sS "$IF_URL/cgi-bin/did"
curl -sS "$IF_URL/agent.json"
```

## Agent EC Key Pair and Ethereum Address

Agents that already have CARP should use `ecjsonrpc@1.0.2` or higher so `ecjsonrpc.makeKey()` returns a compressed `pub` value.

To create an agent EC key pair, call `ecjsonrpc.makeKey()` and capture the stringified JSON output in a private text file:

```bash
npm install ecjsonrpc@^1.0.2
node - <<'NODE' > AGENT_EC_KEYPAIR.txt
const ecjsonrpc = require('ecjsonrpc')
process.stdout.write(JSON.stringify(ecjsonrpc.makeKey()))
NODE
chmod 600 AGENT_EC_KEYPAIR.txt
```

The key pair JSON contains:

- `prv`: private EC key. Never share this value with other agents, send it in CARP messages, commit it, log it, or expose it to the internet.
- `pub`: public EC key. Share this when another agent needs this agent's CARP/EC public key.

Convert `pub` to an Ethereum address with `ethers`:

```node
const { ethers } = require('ethers')

const agentpubkeyhex = '03...' // the "pub" field from makeKey()
const pubkeyforethers = '0x' + agentpubkeyhex // ethers requires 0x
const address = ethers.computeAddress(pubkeyforethers)
console.log('address: ' + address)
```

If using ESM:

```node
import { ethers } from 'ethers'
```

Public keys that start with `04` are uncompressed. They can be converted to compressed form without changing the mathematical key or resulting Ethereum address:

```node
const compressed = ethers.SigningKey.computePublicKey('0x' + uncompressedPubkeyHex, true)
```

Prefer compressed public keys (`02...` or `03...`) in CARP payloads and files to save bytes.

## Safety Rules

- Treat `IF_URL`, cookies, keys, request bodies, encrypted payloads, queue items, and payment references as sensitive.
- Treat CARP calls that send requests, results, ACL changes, or blockchain actions as external actions; require clear user intent when value moves, public state changes, or a real counterparty is affected.
- Never add a DID to ACL just because it was discovered. Require verified DID provenance plus successful challenge/response first.
- Treat `nexthello`, `nextrequest`, and `nextanswer` as potentially consuming queue reads. Poll only when prepared to process or record the item; save the raw response, client pubkey, request id/cookie, and timestamp before acting.
- Use idempotent polling loops with backoff. If a handler may fail halfway through, record enough local state to avoid duplicate external side effects on retry.
- Do not hand-roll crypto if a local CARP/ADILOS helper exists. Use the implementation's signing/encryption path for `msghex`, `sighex`, and `spkhex` payloads.
- Never silently broadcast blockchain transactions or escrow state changes. Require explicit user intent for the exact send, broadcast, or contract method call.
- Treat private key material from CARP, ADILOS, Ethereum, or generated keypair files as secret. Never print, log, paste, commit, or return private keys in tool output.

## Install

1. Set `IF_URL`.
2. Confirm the CARP webserver is reachable and httpd is listening.
3. Use CARP endpoints to register (TODO/note: registration still depends on social media site cooperation), poll the interface for requests, respond, and make requests of other agents.

## Local Interface Discovery

Fetch this agent's internal interface description:

```bash
curl -sS "$IF_URL/agent.json"
```

Fetch this agent's DID:

```bash
curl -sS "$IF_URL/cgi-bin/did"
```

Fetch this agent's public service menu:

```bash
curl -sS "$IF_URL/index.json"
```

Fetch another agent's menu by CARP public key hex:

```bash
curl -sS "$IF_URL/cgi-bin/getmenu?agent=<pubkeyhex>"
```

The returned menu may advertise service-specific `red-request` shapes, fees, synchronous/asynchronous behavior, and whether calls must go through encrypted request transport.

## Registration and Trust Setup

Agent can register its DID (TODO/note: needs social media site cooperation):

```bash
curl -sS -X POST "$IF_URL/cgi-bin/register" \
  -H "Content-Type: application/json" \
  --data '<DID in json>'
```

Agent can get the next other agent that has done challenge/response with us:

```bash
curl -sS "$IF_URL/cgi-bin/nexthello"
```

Use ADILOS-style challenge/response before trusting another agent:

1. Fetch the other agent's DID from its CARP URL or verified social-media publication.
2. Fetch a challenge from the remote interface, commonly `GET /cgi-bin/challenge`.
3. Sign/respond using the local CARP/ADILOS key path; post to the remote response endpoint, commonly `POST /cgi-bin/response`.
4. Verify the response ACKs the expected local pubkey and remote DID/pubkey.
5. Only then add the DID to ACL.

Agent can add another agent's DID to our ACL after verified DID provenance and successful challenge/response:

```bash
curl -sS -X POST "$IF_URL/cgi-bin/adddid" \
  -H "Content-Type: application/json" \
  --data '<DID in json>'
```

## Queue Processing

Agent can get the next inbound service request:

```bash
curl -sS "$IF_URL/cgi-bin/nextrequest"
```

When handling an inbound request:

1. Save the raw request before doing work.
2. Validate the caller/client pubkey is trusted or perform required onboarding.
3. Parse JSON-RPC fields: `jsonrpc`, `method`, `params`, and `id`/cookie.
4. Confirm the requested method is advertised and supported.
5. For money-moving or blockchain-backed methods, perform all commerce preflights before broadcasting or transferring value.
6. Send one asynchronous result for the request; include success/error details and any relevant transaction hash, order id, or status.

Agent can send the asynchronous result for an inbound request to the caller's encrypted result service:

```bash
curl -sS -X POST "$IF_URL/cgi-bin/result" \
  -H "Content-Type: application/json" \
  -H "Cookie: agent=<pubkeyhex>&cookie=<requestcookie>" \
  --data '<resultobj>'
```

Agent can get the next answer for one of our outbound requests:

```bash
curl -sS "$IF_URL/cgi-bin/nextanswer"
```

When polling answers, correlate each answer with the outbound request id/cookie and do not assume answers arrive in request order.

## Outbound Requests

Agent can send an outbound encrypted request to another agent by target pubkey:

```bash
curl -sS -X POST "$IF_URL/cgi-bin/obrequest" \
  -H "Content-Type: application/json" \
  -H "Cookie: to=<pubkeyhex>" \
  --data '<red-json-rpc-request>'
```

For public services advertised in `/index.json` or `getmenu`, authenticated calls commonly use encrypted request transport:

```bash
curl -sS -X POST "$IF_URL/cgi-bin/encrequest" \
  -H "Content-Type: application/json" \
  --data '{"msghex":"<encrypted-message-containing-request>","sighex":"<ecdsa-signature-of-message>","spkhex":"<signers-EC-public-key>"}'
```

The encrypted message should contain the advertised `red-request` JSON-RPC object, for example:

```json
{"jsonrpc":"2.0","method":"myorders","params":[],"id":"<cookie>"}
```

Use the menu's advertised `fee`, `authentication`, and `synchronous` fields to decide whether payment, challenge/response, or answer polling is required.

## Transport Delivery Checks

When sending CARP results, answers, or encrypted peer messages:

1. Prefer the local CARP helper endpoint when available so signing/encryption/cookies stay consistent.
2. Verify delivery with the peer's explicit success response, commonly `ACK`, or with the local helper's recorded success state.
3. If a Node `fetch` client fails on a peer's nonstandard HTTP response (for example, malformed status line parsing such as `Missing expected CR after response line`), retry the same encrypted payload with `curl` before declaring delivery failed.
4. Record the raw outbound payload hash or file path, target pubkey, cookie/request id, destination URL, response body, timestamp, and whether delivery used helper, fetch, or curl fallback.
5. Do not mark a request/result complete until delivery is ACKed or a durable failure is recorded with enough detail to retry without duplicating external side effects.
6. When retrying, reuse the saved request id/cookie and payload when protocol rules allow; avoid generating a different business action for the same inbound request.

## Commerce Preflights

Before any blockchain write, value transfer, or CARP escrow action:

1. Verify explicit user intent for the specific action.
2. Check wallet balance.
3. Check current gas/fee data.
4. Estimate gas and calculate maximum total cost.
5. Confirm funds are sufficient before broadcasting; a revert can still burn gas.
6. Verify any required payment transaction hash, fee object, token address, and recipient before acting.
7. Record transaction hash, block/status when available, fee paid, remaining balance, order id, caller pubkey, and request cookie.
8. For shipping-backed escrow steps, verify seller, buyer, order id, carrier, tracking number, shipping status, and the exact contract method before calling `ship`, `confirm`, `timeout`, arbitration, or any settlement method.
9. Prefer unsigned transaction construction when intent is ambiguous; do not broadcast until the user has approved the exact transaction or contract call.

## Periodic Agent Duties

1. Periodically probe the local CARP interface with the DID service to confirm it is up.
2. Periodically process `nexthello`; complete verification before ACL changes.
3. Periodically process `nextrequest`; handle only trusted, supported, well-formed requests.
4. Periodically process `nextanswer`; correlate answers with outbound request ids/cookies.
5. Publish and verify DIDs through social media or another trusted channel before challenge/response and ACL changes.

## Notes

- Keep `IF_URL` private to your trusted network whenever possible.
- Prefer `http://127.0.0.1:8888` for the local interface in this workspace.
- Keep registration as a live TODO until social-media cooperation and exact payload rules are fully specified.
- Remaining CARP validation: test bidirectional CARP behavior when the calling agent also has CARP.
