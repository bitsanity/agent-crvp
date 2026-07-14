const env = require( './env.js' )
const fs = require( 'node:fs' )
const { ethers } = require( 'ethers' )

const TXNSDIR = './transactions/'

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

  "myorders" : null,
  "getorder" : null,

  "submit" : { amt : "1000000000000000" },
  "buy" : { amt : "1000000000000000" },
  "timeout" : { amt : "1000000000000000" },
  "ship" : { amt : "1000000000000000" },
  "confirm" : { amt : "1000000000000000" },
  "note" : { amt : "1000000000000000" },
  "arbitration" : { amt : "1000000000000000" }
}

//
//
//

exports.agentFee = function( servicename ) {

  let result = JSON.parse( JSON.stringify(AGENT_FEES[servicename]) )
  if (result) {
    result.to = env.VARS.AGENT_ETH_ADDRESS
    result.network = "Ethereum"
  }
  return result

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

exports.isMined = function( ethtxn ) {
  return ethtxn && ethtxn.blockHash != null
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
    if ( !ethtxn.input || ethtxn.input.length < 4 )
      return "insufficient input - not a token transaction"

    if ( ethtxn.to.toLowerCase() !== expected.token.toLowerCase() )
      return "token doesnt match expected"

    let erc20Intf = new ethers.Interface( ERC20ABI )
    let decoded = erc20Intf.parseTransaction( { data: ethtxn.input } )
    if ( decoded.name !== "0x095ea7b3" )
      return "should be an ERC20 approve() transaction"

    if ( decoded.args[1] < expected.tokenunits )
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

exports.setUsed = function( ethtxnhash ) {
  let fname = TXNSDIR + ethtxnhash
  fs.writeFileSync( fname, ":-)", { encoding:'utf-8' } )
}

exports.isUsed = function( ethtxnhash ) {
  let fname = TXNSDIR + ethtxnhash
  return fs.existsSync( fname )
}
