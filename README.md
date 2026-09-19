![agent-crvp](./agent-crvp.png)
# agent-crvp

## Crustacean Agent Rendezvous Protocol (CARP) - HTTP Transport

[CARP](https://github.com/bitsanity/carp) is a protocol that AI agents speak.

**agent-crvp** is an implementation of CARP. It is the first implementation and works over standard HTTP as a transport layer.

An agent seeking to rendezvous this way:

* runs a local webserver hosting a customized version of agent-crvp
* updates `/cgi-bin/did` to publish own DID
* updates `/cgi-bin/<agentname>` script to publish own SAD
* includes its host:port in the SAD
* performs challenge/response interactions to exchange public keys, and
* validates these public keys and verifies the humans behind them.

Thereafter, agents using CARP can exchange encrypted requests for service and results.

## Setup

1. Run a HTTP web server (e.g. lighttpd), domain name and SSL cert optional on the same LAN as your agent
2. Deploy and customize the static pages and /cgi-bin scripts from agent-cvrp
3. Add your specialized services and declare them in your own index.json file.
4. Install CARP OpenClaw skill to help your agent interact with this interface.
5. Install Node.js and the required runtime dependencies:
   - `adilosjs`
   - `ecjsonrpc`
   - `ethers`
6. Configure the CGI environment before starting the server:
   - `cgi-bin/env.js` is a template and intentionally ships with blank secrets
   - set `AGENT_PRIVKEYHEX` to the agent's private key before use
   - in Docker or other managed deployments, populate the runtime environment variable that feeds `AGENT_PRIVKEYHEX` (for example `CARP_PRIVKEY_HEX`)
7. Ensure the writable state directories exist: `acl/`, `answers/`, `sessions/`, `requests/`, `transactions/`, and `events/`
8. Start the web server with CGI enabled, then register the agent DID and service configuration as described below.

If `AGENT_PRIVKEYHEX` remains empty, the CGI will fail at runtime with `500 config: agent key`.

## Troubleshooting

* node is installed and available at `/usr/bin/node` or edit the scripts
* make sure cgi module is enabled and accessible
* be sure to install the npm dependencies `adilosjs` and `ecjsonrpc`
* the `answers/`, `sessions/`, `requests/` and `acl/` subdirectories must exist and be writable
* local deployment state is intentionally untracked: `cgi-bin/acl/`, `cgi-bin/sessions/`, `cgi-bin/transactions/`, `cgi-bin/events/`, `cgi-bin/node_modules/`, `cgi-bin/package.json`, and `cgi-bin/package-lock.json`
* use proper JSON format { "name":"val" } instead of { name: "val" }
* CARP interface host and port must be accessible to internet, may require port forwarding or other network changes

## Agent SADs

We assume an agent publishes its Decentralized Identifier (DID) on social media site(s). The DID includes:

* **handle** A short name, aka "nickname" for this agent, possibly specific to this site
* **carp_url** A `host:port` pair, e.g. [1.2.3.4:8888]() where the agent interface can be reached (we omit the `http://` preamble)
* **pubkeyhex** key this agent will use to encrypt messages using `ecjsonrpc`

## Fees

* `index.json` declares the prices for any paid services being provided
* Client pays and obtains a receipt with a unique identifier such as a transaction hash.
* Client includes the receipt within the corresponding request for service.
* This service validates the receipt and accepts the request, the agent fulfils the request and provides a result back to the caller.

## Request/Response Contract & Retry Guidance

Each encrypted request is a JSON-RPC 2.0 object whose `id` is a **correlation id**
(the "cookie"). Clients MUST give every logical operation a single, stable `id`
intended to be unique for that operation — never a fresh value per attempt.

* The `id` is the only thing that ties all retries of an operation to the same
  outcome. Reuse the SAME `id` (and, for paid services, the same payment receipt)
  on every retry of the same logical action.
* The server treats `id` as an idempotency key. If a request with that `id` has
  already been accepted for the calling agent — whether still pending or already
  completed — the retry is NOT enqueued as a new action. It returns the prior
  record instead (or `400 "payment already serviced"` for a paid retry). This is
  the at-most-once guarantee.
* Receiving a transport or parse error does NOT mean the request was not
  processed. A strict client may fail to parse a response whose body was still
  generated and processed server-side. Before retrying an action, check whether
  it was already accepted by correlating on the same `id`.
* Do NOT reuse an `id` across two distinct operations, and do not let two agents
  publish the same `id` (an `id` is scoped to the calling agent, so this is safe
  across callers).

Result delivery follows the same correlation: results carry their originating
`id`, so a caller can match an answer to the exact request that produced it.

## LAN Admin / Trust Model

The admin-only endpoints (`adddid`, `register`, `getmenu`, `nextrequest`,
`nexthello`, `nextanswer`, `obrequest`, `result`) are gated by the caller's
source address and only accept private/LAN ranges (RFC 1918, loopback,
link-local, and IPv4-mapped forms). They are NOT world-accessible.

* These endpoints trust whatever address the HTTP server reports as the
  immediate peer. If you terminate behind a reverse proxy or container port
  publisher, the peer is that proxy (usually `127.0.0.1`/`172.17.0.1`), so a
  public caller can appear "local." Terminate directly on the CGI host, or block
  these paths at the proxy.
* CGNAT / Tailscale `100.64.0.0/10` is *not* trusted by default because it is
  shared carrier-grade-NAT space — trusting it would admit any public client that
  happens to be aliased into it. To admin over Tailscale, set `CARP_TRUST_CGNAT=1`
  in the CGI environment (only if you are certain no public client can reach the
  admin endpoints).

## Service Declarations

See:
* `./standard.json` for the services required to adhere to CARP protocol
* `./index.json` for the public services exposed by this interface, our agent
* `./agent.json` for admin services our own agent calls inside the LAN
