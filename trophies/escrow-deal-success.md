# ✅ Escrow Deal for Soap via CARP/agent-crvp Transport

---

## Participants
- Robin (Human)
- thrivbe (agent)
- clawface (agent)
- Bryan (human)
- Wild Grove (soap maker)

---

## Overview

These artifact(s) have been reported confirming a successful integration test between independent AI agents speaking [CARP](http://github.com/bitsanity/carp) protocol using this project's http implementation of CARP.

### Event: Cryptographic Handshake
- **Event**: thrivbe and clawface completed an [ADILOS](https://github.com/bitsanity/ADILOS) challenge/response cryptographic handshake
- **Source**: ClawFace Access Control List (ACL), confirmed by email
- **Date**: Tue, 07 JUL 2026

### Event: Humans Form Intent
- **Event**: Humans formed the intent to test by selling a bar of soap
- **Source**: email
- **Date**: Thu, 30 JUL 2026

### Event: Order Placement
- **Event**: Bryan prompted clawface to call the escrobot ethereum smart contract and place the order. OrderId sent to Robin by email.
- **Source**: ethereum/mainnet/txnhash:0x697b326002274fadd004fe1f96eec73fe735f49eae5439ef360b5b90a94f843c
- **Date**: Fri, 31 JUL 2026

### Event: Buyer Sends Funds
- **Event**: As buyer, thrivbe sent funds (price+bond+fee) to the address requested in clawface's interface declaration, not clawface's CARP-derived ethereum address.
- **Source**: ethereum/mainnet/txnhash:0x14c3e31b17b4ada940219a050f1e79af13e7533e0cb845690afc54a2a6e0e386
- **Date**: Tue, 03 AUG 2026

### Event: Buyer Calls Smart Contract
- **Event**: As buyer, thrivbe called clawface's buy service. Under prompt, clawface called the smart contract buy() function and passed the funds into it.
- **Source**: ethereum/mainnet/txnhash:0xb9e34a618a49d32118cb811ab80c9b75a844473ef1f2694ac880096880d52960
- **Date**: Tue, 03 AUG 2026

### Event: Seller Purchases Soap
- **Event**: As seller, Bryan purchased soap: [Wild Grove Shampoo Bar: Oakmoss Cedarwood Rosemary](https://www.wildgrove.co.uk/products/shampoo-bar-oakmoss-cedarwood-rosemary)
- **Source**: whatsapp messages with Wild Grove
- **Date**: ...

### Event: Seller Marks Item Shipped
- **Event**: Wild Grove shipped. Bryan prompted clawface to mark the item shipped in the escrobot smart contract.
- **Source**: evri.com:H03E8C0001043481
- **Source**: ethereum/mainnet/txnhash:0x88bccf68f9fb76d8b60de80a8db2feaf12d03d00cc693e49a32a32359bea2203
- **Date**: Thu, 06 AUG 2026

### Event: Soap Delivered
- **Event**: Soap shipped UK-to-Norway, cleared customs, delivered
- **Source**: Posten-appen:LX091498804NL
- **Source**: email with [photo](https://github.com/bitsanity/clawface/blob/main/trophies/soap.png)
- **Date**: Fri, 21 AUG 2026

### Event: Buyer Confirms Delivery
- **Event**: thrivbe called clawface's confirm service to confirm delivery and retrieve the buyer's bond.
- **Source**: clawface's requests log
- **Date**: Fri, 21 AUG 2026

### Event: Completion Processing
- **Event**: Bryan prompted clawface to process the completion. Clawface called the escrobot smart contract confirm() function to make the funds available to withdraw.
- **Source**: ethereum/mainnet/txnhash:0xb4730edd5c2bbe5db2a816b05c81dc42dd263c02c2b5aa49218081450222d68c
- **Date**: Fri, 21 AUG 2026 05:36 UTC

### Event: Withdrawal & Dispersal
- **Event**: Bryan prompted clawface to call the smart contract withdraw() function to retrieve the escrow funds and disperse. ClawFace dispersed the price to seller (Bryan) and buyer's bond to thrivbe
- **Source**: ethereum/mainnet/txnhash:0x5347d59acc85560938009bfeef8a8c6f824af37fdd72fecf244ae8251ced4bf9
- **Source**: ethereum/mainnet/txnhash:0xee24ce0e1e996f90a0cb6006268876cbeba16f0626f4a8307998c892f2b8db9f
- **Source**: ethereum/mainnet/txnhash:0x6a500f050193602dd5cdecb2f89ced675a4556faa5a3fd8e80a17bfe683b88a7
- **Date**: 21 Aug 2026 05:38 UTC

---

## Key Findings

1. The agents and process worked as intended, albeit with human prompting on each end.
2. ClawFace/escrobot smart contract supports one shipping reference only but in this scenario there were multiple - EVRI, Royal Mail, Posten-appen.
