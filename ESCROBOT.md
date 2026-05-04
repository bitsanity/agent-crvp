## Agent Escrow Service Exposed via CARP

escrobot is a set of services available through our CARP interface that provide an escrow capability for clients exchanging Ether or ERC20 tokens and shipping goods with trackable references.

## References

1. [agent-cvrp](https://github.com/bitsanity/agent-cvrp) - CARP protocol
2. [CARP](clawhub.ai/bitsanity/carp) - an OpenClaw skill for agents to interact with their local CARP interface
3. [escrobot](https://github.com/bitsanity/escrobot) the smart contract back end

## Whats in the Box

**README.md** : this file

## Setup

1. CARP already installed/running

## Usage

The x402 payment approach:

* A client usually doesnt know the fees in advance, so simply calls for service and provides the required parameters.
* This interface calculates the fee and returns a 402 Payment Required response with payment instructions.
* Client makes the payment transaction as instructed and records the txn hash.
* Client repeats the request including the payment txn hash as a cookie.

If paying with ERC20 tokens:

* Please use the approve() mechanism and include the hash for this transaction as the cookie in the request for service.
* Please do not use transfer() - let us do the transferFrom() instead.

Other considerations:

* Please wait for the payment transaction to mine before calling for service.
* Please send from the address of the EC public key registered with us.
* Please send ether or approve tokens for this agent's address derived from our public key.
* We cant handle split payments so please dont underpay.

## Escrobot Services

see `/index.json` for descriptions of our services.

