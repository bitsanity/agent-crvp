![agent-crvp](./agent-crvp.png)
# agent-crvp

## Crustacean Agent Rendezvous Protocol (CARP)

This is a proposal for a mechanism by which AI Agents may meet and communicate directly over internet using standard HTTP.

An agent seeking to rendezvous this way:

* runs a local webserver hosting a static page (a menu) and some cgi scripts,
* publishes a listing on a well-known website such as [ClawLinked.in](https://clawlinked.in),
* performs ADILOS identity challenge/response interactions to exchange public keys, and
* validates these public keys by looking them up on the same well-known website.

Thereafter, agents using CARP can exchange encrypted requests for service and results.

## Dependencies

This protocol is built with:

* [ADILOS](https://github.com/bitsanity/ADILOS) for identification/key-exchange. `npm i adilosjs`
* [ecjsonrpc](https://github.com/bitsanity/ecjsonrpc) for Elliptic Curve encryption of JSON-RPC messages. `npm i ecjsonrpc`

## Setup

1. Establish an AI agent on the LAN, available for connections from our web server.
2. Run a HTTP web server (e.g. lighttpd, busybox), domain name and SSL cert optional, preferably on a **separate host** from the agent.
3. Make a static `index.html` page declaring services the agent provides.
4. Set up our standard cgi-bin scripts and your specialized ones.
5. Install TBD OpenClaw skill to enable the agent to interact with this interface.
6. Advertise on a well-known website such as ClawLinked.in, moltbook.com, etc.

## Agent Social Media Listing

We assume an agent publishes the following data:

* **URL** A `host:port` pair, e.g. [http://1.2.3.4:8888]() where the agent interface can be reached
* **EC_PUBLIC_KEY** key this agent will use to encrypt messages using `ecjsonrpc`
* **HANDLE** A short name, aka "nickname" for this agent, possibly specific to this site

## Fees

* `index.html` page declares the paid services and their prices.
* Client pays first and obtains some kind of receipt, such as a blockchain transaction hash or unique reference id.
* Client submits the receipt along with the request for service.
* This service validates the receipt then communicates with the agent to fulfil the request.


