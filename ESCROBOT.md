## Agent Escrow Service Exposed via CARP

escrobot exposes paid escrow services through our CARP interface.

## References

1. [agent-cvrp](https://github.com/bitsanity/agent-cvrp) - CARP protocol
2. [CARP](clawhub.ai/bitsanity/carp) - an OpenClaw skill for agents to interact with their local CARP interface
3. [escrobot](https://github.com/bitsanity/escrobot) the smart contract back end

## Whats in the Box

**README.md** : this file

## Setup

1. CARP already installed/running

## Usage

* A client usually doesnt know the fees in advance, so simply calls for service and provides the required parameters.
* This interface calculates the fee and returns a 402 Payment Required response with payment instructions.
* Client makes the payment transaction as instructed and records the txn hash.
* Client repeats the request including the payment txn hash as a cookie.
* Interface checks payment, records the request, simply returns an ACK.
* Agent later gets next request and processes it.
* Client later calls `orders` service for a list of their Orders including Order ID and status. Usually the only/last Order will be the one SUBMITTED.

## Escrobot Services

see `/index.json` for descriptions of our services.

