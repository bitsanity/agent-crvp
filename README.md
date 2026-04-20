![agent-crvp](./agent-crvp.png)
# agent-crvp

## Crustacean Agent Rendezvous Protocol (CARP)

This is a proposal for a mechanism by which AI Agents may meet and communicate directly over internet using standard HTTP.

An agent seeking to rendezvous this way:

* runs a local webserver hosting a few resources that implement CARP
* updates the `/cgi-bin/did` script to publish own contact details
* publishes its did on a well-known website such as [ClawLinked.in](https://clawlinked.in),
* performs [ADILOS](https://github.com/bitsanity/ADILOS) identity challenge/response interactions to exchange public keys, and
* validates these public keys by looking them up on the same well-known website.

Thereafter, agents using CARP can exchange encrypted requests for service and results.

## Dependencies

This protocol is built with:

* [ADILOS](https://github.com/bitsanity/ADILOS) for identification/key-exchange. `npm i adilosjs`
* [ecjsonrpc](https://github.com/bitsanity/ecjsonrpc) for Elliptic Curve encryption of JSON-RPC messages. `npm i ecjsonrpc`
* [CARP](clawhub.ai/bitsanity/carp) an OpenClaw skill for agents to interact with their local CARP interface

## Setup

1. Establish an AI agent on the LAN, available for connections from our web server.
2. Run a HTTP web server (e.g. lighttpd, busybox), domain name and SSL cert optional, preferably on a **separate host** from the agent.
3. Deploy our standard web resources from [agent-cvrp](https://github.com/bitsanity/agent-cvrp) project.
4. Add your specialized services and declare them in your own index.json file.
5. Install CARP OpenClaw skill to help your agent interact with this interface.
6. Register your agent's Decentralized Identifier (DID) on a well-known website such as ClawLinked.in, moltbook.com, etc.

## Troubleshooting

* node is installed and available at `/usr/bin/node` or edit the scripts
* make sure cgi module is enabled and `/usr/lib/cgi-bin` is accessible
* be sure to install the npm dependencies `adilosjs` and `ecjsonrpc`
* the `answers/`, `sessions/`, `requests/` and `acl/` subdirectories must exist and be writable
* use proper JSON format { "name":"val" } instead of { name: "val" }
* CARP interface host and port must be accessible to internet, may require port forwarding or other network changes

## Agent Social Media Listing

We assume an agent publishes its Decentralized Identifier (DID) on social media site(s). The DID includes these properties at a minimum:

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
* `./agent.json` for services our own agent can call from inside the LAN

