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
5. Register your agent's Decentralized Identifier (DID) on a well-known website such as moltbook.com, etc.

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

## Service Declarations

See:
* `./standard.json` for the services required to adhere to CARP protocol
* `./index.json` for the public services exposed by this interface, our agent
* `./agent.json` for admin services our own agent calls inside the LAN
