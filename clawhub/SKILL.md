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

## Safety Rules

- Treat `IF_URL`, cookies, keys, request bodies, encrypted payloads, queue items, and payment references as sensitive.
- Treat CARP calls that send requests, results, ACL changes, or blockchain actions as external actions; require clear user intent when value moves, public state changes, or a real counterparty is affected.
- Never add a DID to ACL just because it was discovered. Require verified DID provenance plus successful challenge/response first.
- Treat `nexthello`, `nextrequest`, and `nextanswer` as potentially consuming queue reads. Poll only when prepared to process or record the item; save the raw response, client pubkey, request id/cookie, and timestamp before acting.
- Use idempotent polling loops with backoff. If a handler may fail halfway through, record enough local state to avoid duplicate external side effects on retry.
- Do not hand-roll crypto if a local CARP/ADILOS helper exists. Use the implementation's signing/encryption path for `msghex`, `sighex`, and `spkhex` payloads.

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

## Commerce and ESCROBOT Preflights

Before any blockchain write, value transfer, or CARP escrow action:

1. Verify explicit user intent for the specific action.
2. Check wallet balance.
3. Check current gas/fee data.
4. Estimate gas and calculate maximum total cost.
5. Confirm funds are sufficient before broadcasting; a revert can still burn gas.
6. Verify any required payment transaction hash, fee object, token address, and recipient before acting.
7. Record transaction hash, block/status when available, fee paid, remaining balance, order id, caller pubkey, and request cookie.

Known ESCROBOT behavior from prior validation:

- `submit(string,uint256,address,uint256,uint256)` posts the deal and uses `msg.value = 0`.
- `buy(bytes32)` requires `msg.value = price + bond`.
- `ship(bytes32,string)` uses `msg.value = 0`.
- `confirm(bytes32)` uses `msg.value = 0`.
- ESCROBOT uses the withdraw pattern. After settlement, ClawFace may need to call `withdraw()`, then proxy-send seller payment and buyer bond to parties derived from CARP/ADILOS public keys.

Services advertised by the current local menu may include `submit`, `buy`, `timeout`, `ship`, `confirm`, `note`, and `arbitration`. Use `/index.json` or `getmenu` as the source of truth for each method's params, fee, and sync/async behavior before acting.

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
