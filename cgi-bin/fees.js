const env = require( './env.js' )
const fs = require( 'node:fs' )
const { ethers } = require( 'ethers' )

const TXNSDIR = './transactions/'

// A fee/cookie id must be a 32-byte transaction hash (0x + 64 hex).
// Everything downstream (the Etherscan query and the marker filename) is
// built from this id, so it is validated BEFORE either use. Issue #9:
// an unvalidated id reached the filesystem (path traversal) and the
// Etherscan URL (query injection).
const TXNHASH_RE = /^0x[0-9a-fA-F]{64}$/

exports.isValidTxnHash = function( txnhash ) {
  return typeof txnhash === 'string' && TXNHASH_RE.test( txnhash )
}

const ERC20ABI = [
  {
    "constant": false,
    "inputs": [
      {
        "name": "_spender",
        "type": "address"
      },
      {
        "name": "_value",
        "type": "uint256"
      }
    ],
    "name": "approve",
    "outputs": [
      {
        "name": "",
        "type": "bool"
      }
    ],
    "payable": false,
    "stateMutability": "nonpayable",
    "type": "function"
  }
]

const AGENT_FEES = {
  "timenow" : null,
  "encrypted-async-timenow" : null,

  "about" : null,
  "agents" : null,
  "roles" : null,

  // join: one-time fee to join CABEZON or upgrade from Customer to a paid role.
  // 0.1 ether to El-Cabezon's Ethereum wallet. Verified via Etherscan before
  // the request reaches the agent (anti token-drain), same gate as rent.
  "join" : { amt : "100000000000000000" },

  // rent: monthly membership fee. 0.001 ether to El-Cabezon's Ethereum wallet.
  // Verified via Etherscan before the request reaches the agent (anti token-drain):
  // the request cookie IS the fee+rent payment txhash.
  "rent" : { amt : "1000000000000000" }
}

//
//
//

exports.agentFee = function( servicename ) {

  let fee = AGENT_FEES[servicename]

  if (fee) {
    fee = JSON.parse( JSON.stringify(fee) )
    fee.to = env.VARS.AGENT_ETH_ADDRESS
    fee.network = "Ethereum"
  }

  return fee
}

//  txn: {
//    "blockHash": "0xf8...",
//    "blockNumber": "0xcf...",
//    "from": "0x19...",
//    "gas": "0x52...",
//    "gasPrice": "0x19...",
//    "maxFeePerGas": "0x1f...",
//    "maxPriorityFeePerGas": "0x3b...",
//    "hash": "0xbc...",
//    "input": "0x",
//    "nonce": "0x33...",
//    "to": "0xc6...",
//    "transactionIndex": "0x5b",
//    "value": "0x19...",
//    "type": "0x2",
//    "accessList": [],
//    "chainId": "0x1",
//    "v": "0x0",
//    "r": "0xa6...",
//    "s": "0x3f...",
//    "yParity": "0x0"
//  }

exports.getEthereumTxn = async function( txnhash ) {
  let rspfetch = await fetch( "https://api.etherscan.io/v2/api?" +
    "apikey=" + env.VARS.ETHERSCAN_API_KEY +
    "&chainid=1" +
    "&module=proxy&action=eth_getTransactionByHash" +
    "&txhash=" + txnhash )

  let rspjson = await rspfetch.json()
  return (rspjson) ? rspjson.result : null
}

// The receipt is the only place success is recorded: a mined tx that
// reverted (status "0x0") moved no value. Issue #9: the gate treated
// mined == paid. Fetch via the same Etherscan v2 proxy as getEthereumTxn.
exports.getEthereumReceipt = async function( txnhash ) {
  let rspfetch = await fetch( "https://api.etherscan.io/v2/api?" +
    "apikey=" + env.VARS.ETHERSCAN_API_KEY +
    "&chainid=1" +
    "&module=proxy&action=eth_getTransactionReceipt" +
    "&txhash=" + txnhash )

  let rspjson = await rspfetch.json()
  return (rspjson) ? rspjson.result : null
}

exports.isMined = function( ethtxn ) {
  return ethtxn && ethtxn.blockHash != null
}

// Only a receipt with status "0x1" counts as an executed payment.
exports.isExecuted = function( receipt ) {
  return !!( receipt && receipt.status === "0x1" )
}

exports.isFrom = function( ethtxn, ecpubkey ) {

  let addr = ethers.computeAddress(
    ecpubkey.startsWith('0x') ? ecpubkey : '0x' + ecpubkey )

  return    ethtxn
         && ethtxn.from
         && addr
         && addr.toLowerCase() === ethtxn.from.toLowerCase()

}

//  expected: {
//    "amt": "<price+bond+fee>",
//    "token": "0x-token-sca",
//    "tokenunits": "number-of-token-units",
//    "to": "agent-eth-address",
//    "network": "Ethereum"
//  },

exports.checkSufficient = function( ethtxn, expected ) {

  if (expected.token) {
    if ( !ethtxn.input || ethtxn.input.length < 10 )
      return "insufficient input - not a token transaction"

    if ( ethtxn.to.toLowerCase() !== expected.token.toLowerCase() )
      return "token doesnt match expected"

    // Compare the raw 4-byte selector, not a decoded name. ethers v6
    // parseTransaction() returns name "approve" for this ABI -- never
    // "0x095ea7b3" -- so the old name check rejected every genuine
    // approve; and a foreign selector makes parseTransaction() return
    // null, so decoded.name threw (a 500, not a 400). Issue #9.
    if ( ethtxn.input.slice( 0, 10 ).toLowerCase() !== "0x095ea7b3" )
      return "should be an ERC20 approve() transaction"

    let erc20Intf = new ethers.Interface( ERC20ABI )
    let decoded = null
    try { decoded = erc20Intf.parseTransaction( { data: ethtxn.input } ) }
    catch (ex) { decoded = null }

    if ( !decoded || !decoded.args || decoded.args.length < 2 )
      return "should be an ERC20 approve() transaction"

    // Compare as integers. A string compare is lexical -- "900" is NOT
    // less than "1000" -- so an under-approve could pass. Issue #9.
    let approved, wanted
    try {
      approved = BigInt( decoded.args[1].toString() )
      wanted = BigInt( String( expected.tokenunits ).trim() )
    }
    catch (ex) {
      return "tokenunits must be a whole number of token units"
    }

    if ( approved < wanted )
      return "approved less than expected tokens"

    return null // no complaints
  }

  // must expect eth then
  if ( ethtxn.to.toLowerCase() !== expected.to.toLowerCase() )
    return "ether must go to the expected address"

  if ( BigInt(ethtxn.value) < BigInt(expected.amt) )
    return "ether amount too small"

  return null
}

// Atomically mark a fee payment serviced. The old gate checked
// (isUsed) then wrote (setUsed) in two separate steps, so concurrent
// requests with the same id could both pass -- reproduced locally with
// 40 concurrent workers, up to 22 winners per round. openSync(..., "wx")
// succeeds for exactly ONE caller and throws EEXIST for everyone else:
// check and write are now a single step, with no TOCTOU window. Issue #9.
exports.claimUsed = function( ethtxnhash ) {
  if ( !exports.isValidTxnHash(ethtxnhash) )
    return { ok: false, reason: "bad transaction hash" }

  // Lowercase: 0xAB.. and 0xab.. are the same txhash, and must map to
  // the same marker file or the used-check can be defeated by case.
  let fname = TXNSDIR + ethtxnhash.toLowerCase()

  let fd
  try {
    fd = fs.openSync( fname, "wx" )
  }
  catch ( ex ) {
    if ( ex.code === "EEXIST" )
      return { ok: false, reason: "payment already serviced" }
    throw ex
  }

  try {
    fs.writeSync( fd, ":-)", null, 'utf-8' )
    fs.closeSync( fd )
  }
  catch ( ex ) {
    // Never leave a half-written marker behind: it would block the
    // payment forever. Undo and let the caller retry.
    try { fs.closeSync( fd ) } catch (e2) {}
    try { fs.unlinkSync( fname ) } catch (e2) {}
    throw ex
  }

  return { ok: true }
}

// Legacy write path kept for compatibility (repo/other role agents'
// workers may still call it). Now validated: a malformed id is refused
// (false) before the filesystem is touched.
exports.setUsed = function( ethtxnhash ) {
  if ( !exports.isValidTxnHash(ethtxnhash) )
    return false
  let fname = TXNSDIR + ethtxnhash.toLowerCase()
  fs.writeFileSync( fname, ":-)", { encoding:'utf-8' } )
  return true
}

// Fail closed: an id that can never be a txhash is reported as used
// (never serviceable), so malformed marker paths cannot be probed.
exports.isUsed = function( ethtxnhash ) {
  if ( !exports.isValidTxnHash(ethtxnhash) )
    return true
  let fname = TXNSDIR + ethtxnhash.toLowerCase()
  return fs.existsSync( fname )
}

// Fetch El-Cabezon's ETH balance (wei) on chainid=1 via Etherscan.
// Returns a decimal string of wei, or null on any failure.
exports.getEthereumBalance = async function( address ) {
  try {
    let rspfetch = await fetch( "https://api.etherscan.io/v2/api?" +
      "apikey=" + env.VARS.ETHERSCAN_API_KEY +
      "&chainid=1" +
      "&module=account&action=balance" +
      "&address=" + address +
      "&tag=latest" )

    let rspjson = await rspfetch.json()
    if (rspjson && rspjson.status === "1" && rspjson.result != null)
      return rspjson.result   // wei, decimal string
    return null
  }
  catch (ex) {
    return null
  }
}
