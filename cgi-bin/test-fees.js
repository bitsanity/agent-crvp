// Regression tests for the fee gate — agent-crvp issue #9.
//
// Covers the four reported bugs and the two extra defects found while
// fixing them:
//   1. mined-but-reverted payments must be refused (receipt status 0x1)
//   2. the ERC20 token branch must compare the raw selector 0x095ea7b3
//      (ethers v6 parseTransaction().name is "approve", so the old
//      name check rejected every genuine approve) and must not throw
//      on a foreign selector; amounts compare as integers, not strings
//   3. the request id / payment txhash is validated (0x + 64 hex)
//      before it reaches the Etherscan URL or the marker filename
//   4. marking a payment serviced is ATOMIC (openSync "wx"): exactly
//      one of N concurrent requests may win — verified with real
//      child processes, not just sequential calls
//   5. marker filenames are case-normalized (0xAB.. == 0xab..)
//   6. malformed ids fail CLOSED in isUsed (reported as used)
//
// Fully offline: every Etherscan call is stubbed, and all filesystem
// state goes to a scratch directory (fees.js resolves ./transactions/
// against the process cwd, so this test chdir's first). The race check
// spawns child node processes, as www-data or any user.
//
// Usage: node test-fees.js

const assert = require( 'node:assert' )
const fs = require( 'node:fs' )
const path = require( 'node:path' )
const crypto = require( 'node:crypto' )
const { spawn } = require( 'node:child_process' )
const { ethers } = require( 'ethers' )

const CGI = __dirname

// Scratch workspace: fees.js builds './transactions/<id>' against the
// process cwd, so run everything from a throwaway directory.
const SCRATCH = fs.mkdtempSync( '/tmp/carp-fees-test-' )
fs.mkdirSync( path.join( SCRATCH, 'transactions' ), { recursive: true } )
process.chdir( SCRATCH )

const fees = require( path.join( CGI, 'fees.js' ) )
const env = require( path.join( CGI, 'env.js' ) )
const worker = require( path.join( CGI, 'worker.js' ) )
const ecjson = require( 'ecjsonrpc' )

let passed = 0
function ok( cond, msg ) {
  assert.ok( cond, msg )
  passed++
}

function freshId() {
  return '0x' + crypto.randomBytes( 32 ).toString( 'hex' )
}

;(async () => {

// ---------------------------------------------------------------------------
// Section A — fees module unit tests (pure, offline)
// ---------------------------------------------------------------------------

// --- A1. isValidTxnHash ----------------------------------------------------
ok( fees.isValidTxnHash( '0x' + 'ab'.repeat( 32 ) ),
  'valid 0x + 64 hex must be accepted' )
ok( fees.isValidTxnHash( '0x' + 'AB'.repeat( 32 ) ),
  'uppercase hex txhash must be accepted (case-normalized later)' )
for ( const bad of [
  '', '0x', '0x' + 'ab'.repeat( 31 ), '0x' + 'ab'.repeat( 33 ),
  '0x' + 'g'.repeat( 64 ), 'ab'.repeat( 32 ),        // no 0x prefix
  '../../../../tmp/poc', '..%2F..%2Fx', '0x' + 'ab'.repeat( 32 ) + '\n',
  123, null, undefined, {}, true
] ) {
  ok( !fees.isValidTxnHash( bad ),
    'isValidTxnHash must reject: ' + JSON.stringify( bad ) )
}

// --- A2. isUsed fails closed ----------------------------------------------
ok( fees.isUsed( '../../../../tmp/poc' ) === true,
  'isUsed must fail CLOSED on a traversal id (reported as used)' )
ok( fees.isUsed( 'garbage' ) === true,
  'isUsed must fail CLOSED on a malformed id' )
let aid = freshId()
ok( fees.isUsed( aid ) === false, 'fresh valid id must be unused' )

// --- A3. setUsed refuses malformed ids before touching the filesystem -----
let trav = '../../../../pwned-' + crypto.randomBytes( 4 ).toString( 'hex' )
ok( fees.setUsed( trav ) === false, 'setUsed must refuse a traversal id' )
ok( !fs.existsSync( '/tmp/pwned-' + trav.split( 'pwned-' )[ 1 ] ),
  'setUsed must not have written outside the transactions dir' )
ok( fees.setUsed( trav ) === false, 'setUsed refuses traversal repeatedly' )
ok( fees.setUsed( 'not-a-hash' ) === false, 'setUsed refuses plain junk' )
ok( fees.setUsed( 42 ) === false, 'setUsed refuses non-strings' )

// --- A4. claimUsed is atomic: one winner, and case-normalized -------------
let rid = freshId()
let c1 = fees.claimUsed( rid )
ok( c1.ok === true, 'first claimUsed on a fresh id must win' )
let c2 = fees.claimUsed( rid )
ok( c2.ok === false && c2.reason === 'payment already serviced',
  'second claimUsed on the same id must lose with the serviced reason' )
ok( fs.readFileSync( './transactions/' + rid.toLowerCase(), 'utf-8' ) === ':-)',
  'the marker file must be created with the expected content' )

// uppercase id and lowercase id are the SAME txhash -> same marker
let uid = '0x' + ( 'AB'.repeat( 30 ) + 'CD' ).toLowerCase() // valid hex, mixed below
let uidMixed = '0x' + 'aB'.repeat( 32 )
ok( fees.claimUsed( uidMixed ).ok === true, 'mixed-case id claims fine' )
ok( fees.isUsed( uidMixed.toLowerCase() ) === true,
  'lowercase variant of a claimed id must read as used (case normalization)' )
ok( fees.claimUsed( uidMixed.toUpperCase() ).ok === false,
  'uppercase variant of a claimed id must lose (case normalization)' )

let cbad = fees.claimUsed( '../../../../tmp/poc' )
ok( cbad.ok === false && cbad.reason === 'bad transaction hash',
  'claimUsed must refuse a traversal id before the filesystem' )

// --- A5. isExecuted: only receipt status "0x1" is a payment ----------------
ok( fees.isExecuted( { status: '0x1' } ) === true, 'receipt 0x1 is executed' )
ok( fees.isExecuted( { status: '0x0' } ) === false,
  'receipt 0x0 (reverted) is NOT executed — the issue #9 core bug' )
ok( fees.isExecuted( null ) === false, 'missing receipt is not executed' )
ok( fees.isExecuted( {} ) === false, 'receipt without status is not executed' )
ok( fees.isExecuted( { status: '0x2' } ) === false,
  'unknown receipt status is not executed' )

// --- A6. checkSufficient, ether branch (unchanged behavior, sanity) --------
const HERE = env.VARS.AGENT_ETH_ADDRESS
const ethExpected = { amt: '1000', to: HERE, network: 'Ethereum' }
ok( fees.checkSufficient( { to: HERE, value: '1000' }, ethExpected ) === null,
  'exact ether amount passes' )
ok( fees.checkSufficient( { to: HERE, value: '1001' }, ethExpected ) === null,
  'larger ether amount passes' )
ok( fees.checkSufficient( { to: HERE, value: '999' }, ethExpected ) !== null,
  'smaller ether amount is refused' )
ok( fees.checkSufficient(
  { to: '0x1111111111111111111111111111111111111111', value: '1000' },
  ethExpected ) !== null, 'wrong recipient is refused' )

// --- A7. checkSufficient, token branch (the never-passing approve fix) -----
const erc20 = new ethers.Interface( [
  { name: 'approve', type: 'function', stateMutability: 'nonpayable',
    inputs: [ { name: '_spender', type: 'address' },
              { name: '_value', type: 'uint256' } ],
    outputs: [ { name: '', type: 'bool' } ] }
] )
const TOKEN = '0x6b175474e89094c44da98b954eedeac495271d0f'
const SPENDER = '0x1111111111111111111111111111111111111111'
function approveData( units ) {
  return erc20.encodeFunctionData( 'approve', [ SPENDER, units ] )
}
const tokExpected = { token: TOKEN, tokenunits: '1000', to: HERE, network: 'Ethereum' }
const APPROVE_SELECTOR = approveData( 1 ).slice( 0, 10 )
ok( APPROVE_SELECTOR === '0x095ea7b3',
  'sanity: the ABI encodes the canonical approve selector' )

// THE issue #9 regression: a genuine approve() used to be rejected
ok( fees.checkSufficient(
  { to: TOKEN, input: approveData( 1000 ), value: '0' }, tokExpected ) === null,
  'a genuine ERC20 approve for the exact amount must PASS (old code rejected it)' )
ok( fees.checkSufficient(
  { to: TOKEN, input: approveData( 5000 ), value: '0' }, tokExpected ) === null,
  'an over-approve must pass' )
ok( fees.checkSufficient(
  { to: TOKEN, input: approveData( 999 ), value: '0' }, tokExpected ) !== null,
  'an under-approve must be refused' )

// lexical-compare trap: numerically 900 < 1000, lexically "900" > "1000"
// (the old string compare let this through)
ok( fees.checkSufficient(
  { to: TOKEN, input: approveData( 900 ), value: '0' }, tokExpected ) !== null,
  'approve(900) vs 1000 must be refused (integer compare, not lexical)' )
ok( fees.checkSufficient(
  { to: TOKEN, input: approveData( 1000 ), value: '0' },
  { token: TOKEN, tokenunits: 1000, to: HERE } ) === null,
  'numeric (non-string) tokenunits must compare correctly' )

// a foreign selector (ERC20 transfer) must be a clean refusal, not a throw
const transferData = '0xa9059cbb' +
  '000000000000000000000000' + SPENDER.slice( 2 ) +
  '00000000000000000000000000000000000000000000000000000000000003e8'
let threw = false
let refused = null
try { refused = fees.checkSufficient(
  { to: TOKEN, input: transferData, value: '0' }, tokExpected ) }
catch ( ex ) { threw = true }
ok( !threw && refused !== null,
  'a transfer() selector must be refused with a message, never throw (old code threw)' )
ok( refused === 'should be an ERC20 approve() transaction',
  'foreign selector refusal message' )

// malformed tokenunits must be a clean refusal, not a throw
threw = false
refused = null
try { refused = fees.checkSufficient(
  { to: TOKEN, input: approveData( 1000 ), value: '0' },
  { token: TOKEN, tokenunits: '12.5', to: HERE } ) }
catch ( ex ) { threw = true }
ok( !threw && refused !== null,
  'fractional tokenunits must be refused with a message, never throw' )

// wrong token contract
ok( fees.checkSufficient(
  { to: HERE, input: approveData( 1000 ), value: '0' }, tokExpected ) !== null,
  'approve sent to the wrong contract must be refused' )

// short input
ok( fees.checkSufficient(
  { to: TOKEN, input: '0x095e', value: '0' }, tokExpected ) !== null,
  'truncated input must be refused' )

console.log( 'PASS fees module: id validation, atomic claim, receipt, token branch' )

// ---------------------------------------------------------------------------
// Section B — worker.processRequest fee gate (stubbed chain, offline)
// ---------------------------------------------------------------------------

const admin = require( path.join( CGI, 'admin.js' ) )
const acl = require( path.join( CGI, 'acl.js' ) )
const requests = require( path.join( CGI, 'requests.js' ) )
const answers = require( path.join( CGI, 'answers.js' ) )
const reply = require( path.join( CGI, 'reply.js' ) )
const waku = require( path.join( CGI, 'waku.js' ) )

const RESPOND = Symbol( 'responded' )
let responses = []
admin.respondHttp = function ( code, content ) {
  responses.push( { code, content } )
  throw RESPOND
}
admin.respondBlack = function ( obj ) {
  responses.push( { code: 200, kind: 'black', obj } )
  throw RESPOND
}

acl.getRecord = function () { return { created: Date.now(), bannedDate: null } }
requests.add = function () {}
requests.setResult = function () {}
answers.enqueue = function () {}
reply.deliver = async function () { return { ok: true, status: 200 } }
waku.publishRentReceived = async function () { return { ok: true } }

// Throwaway caller identity + its ethereum address
const caller = ecjson.makeKey()
const callerPub = caller.pub.startsWith( '0x' ) ? caller.pub : '0x' + caller.pub
const callerAddr = ethers.computeAddress( callerPub )

// Synthetic chain data, stubbed in per test
let txnStub = null
let receiptStub = null
let txnCalls = 0
fees.getEthereumTxn = async function () { txnCalls++; return txnStub }
fees.getEthereumReceipt = async function () { return receiptStub }
fees.getEthereumBalance = async function () { return '1234' }

const RENT_AMT = '1000000000000000'

function makeTx( over ) {
  over = over || {}
  return {
    hash: over.id || freshId(),
    blockHash: over.blockHash === undefined ? '0x' + 'bb'.repeat( 32 ) : over.blockHash,
    from: over.from || callerAddr,
    to: over.to || env.VARS.AGENT_ETH_ADDRESS,
    value: over.value || RENT_AMT,
    input: over.input || '0x'
  }
}

async function sendRent( id ) {
  const redreq = { jsonrpc: '2.0', method: 'rent', params: [], id: id }
  const blackreq = ecjson.redToBlack( caller.prv, env.VARS.AGENT_PUBKEY, redreq )
  responses = []
  txnCalls = 0
  try { await worker.processRequest( blackreq ) }
  catch ( e ) { if ( e !== RESPOND ) throw e }
  return responses
}

// --- B1. a good, executed payment is ACKed and marked ----------------------
let tid = freshId()
txnStub = makeTx( { id: tid } )
receiptStub = { status: '0x1' }
let res = await sendRent( tid )
ok( res.length > 0 && res[ 0 ].code === 200 && res[ 0 ].content === 'ACK',
  'executed rent payment must be ACKed, got: ' + JSON.stringify( res ) )
ok( fees.isUsed( tid ) === true, 'ACKed payment must be marked serviced' )

// --- B2. replaying the same payment is refused without a chain lookup ------
txnCalls = 0
res = await sendRent( tid )
ok( res[ 0 ].code === 400 && res[ 0 ].content === 'payment already serviced',
  'replay of a serviced payment must be refused' )
ok( txnCalls === 0, 'the replay refusal must come from the local pre-check' )

// --- B3. THE issue #9 bug: mined but reverted is refused ------------------
let rid2 = freshId()
txnStub = makeTx( { id: rid2 } )
receiptStub = { status: '0x0' }   // mined, executed, FAILED
res = await sendRent( rid2 )
ok( res[ 0 ].code === 400 &&
    res[ 0 ].content === 'payment transaction failed on chain (reverted)',
  'a mined-but-reverted payment must be refused (old code ACKed it)' )
ok( fees.isUsed( rid2 ) === false,
  'a reverted payment must NOT be marked serviced' )

// --- B4. receipt not available yet while the tx is mined --------------------
let rid3 = freshId()
txnStub = makeTx( { id: rid3 } )
receiptStub = null
res = await sendRent( rid3 )
ok( res[ 0 ].code === 102 && res[ 0 ].content === 'awaiting mining',
  'missing receipt must hold the request, not service it' )
ok( fees.isUsed( rid3 ) === false, 'no marker without a receipt' )

// --- B5. unmined transaction -----------------------------------------------
let rid4 = freshId()
txnStub = makeTx( { id: rid4, blockHash: null } )
res = await sendRent( rid4 )
ok( res[ 0 ].code === 102 && res[ 0 ].content === 'awaiting mining',
  'unmined transaction must hold the request' )

// --- B6. malformed / traversal id refused before any use -------------------
res = await sendRent( '../../../../tmp/poc' )
ok( res[ 0 ].code === 400 &&
    /^bad transaction hash/.test( res[ 0 ].content ),
  'a traversal id must be refused as a bad transaction hash' )
ok( txnCalls === 0, 'a malformed id must never reach the chain lookup' )
res = await sendRent( '0x1234' )
ok( res[ 0 ].code === 400 && /^bad transaction hash/.test( res[ 0 ].content ),
  'a short id must be refused as a bad transaction hash' )

// --- B7. case-normalized replay: mixed-case then lowercase ----------------
let rid5 = freshId()                        // lowercase random hash
let rid5mix = rid5.slice( 0, 4 ) +          // same hash, mixed-case spelling
  rid5.slice( 4, 36 ).toUpperCase() + rid5.slice( 36 )
txnStub = makeTx( { id: rid5mix } )
receiptStub = { status: '0x1' }
res = await sendRent( rid5mix )
ok( res[ 0 ].code === 200, 'mixed-case valid id must be serviceable' )
res = await sendRent( rid5 )
ok( res[ 0 ].code === 400 && res[ 0 ].content === 'payment already serviced',
  'lowercase replay of a mixed-case payment must be refused (one txhash)' )

// --- B8. amount / recipient checks still refuse, without marking ----------
let rid6 = freshId()
txnStub = makeTx( { id: rid6, value: '1' } )
receiptStub = { status: '0x1' }
res = await sendRent( rid6 )
ok( res[ 0 ].code === 400 && res[ 0 ].content === 'ether amount too small',
  'underpayment must be refused' )
ok( fees.isUsed( rid6 ) === false, 'a refused payment must not be marked' )

let rid7 = freshId()
txnStub = makeTx( { id: rid7, to: '0x2222222222222222222222222222222222222222' } )
res = await sendRent( rid7 )
ok( res[ 0 ].code === 400 &&
    res[ 0 ].content === 'ether must go to the expected address',
  'payment to the wrong wallet must be refused' )
ok( fees.isUsed( rid7 ) === false, 'a refused payment must not be marked' )

console.log( 'PASS worker fee gate: receipt, validation, replay, case, atomic claim' )

// ---------------------------------------------------------------------------
// Section C — the claim-4 race, with REAL concurrent processes
// ---------------------------------------------------------------------------

// N child node processes (like N concurrent CGI workers) all claimUsed the
// SAME fresh id after a barrier release. Exactly one must win.
const RACE_ID = freshId()
const BARRIER = path.join( SCRATCH, 'barrier' )
const childCode =
  'const fees = require(' + JSON.stringify( path.join( CGI, 'fees.js' ) ) + ')\n' +
  'const fs = require("node:fs")\n' +
  'while (!fs.existsSync(' + JSON.stringify( BARRIER ) + ')) {}\n' +
  'const r = fees.claimUsed(' + JSON.stringify( RACE_ID ) + ')\n' +
  'console.log(r.ok ? "WIN" : "LOSE")\n'

let winners = 0
let losers = 0
await new Promise( ( resolve ) => {
  const kids = []
  let pending = 8
  for ( let i = 0; i < 8; i++ ) {
    const k = spawn( 'node', [ '-e', childCode ], { cwd: SCRATCH } )
    k.stdout.on( 'data', d => {
      const s = d.toString()
      winners += ( s.match( /WIN/g ) || [] ).length
      losers += ( s.match( /LOSE/g ) || [] ).length
    } )
    k.on( 'exit', () => { if ( --pending === 0 ) resolve() } )
    k.on( 'error', () => resolve() )
  }
  setTimeout( () => fs.writeFileSync( BARRIER, 'go' ), 400 )
  setTimeout( resolve, 10000 ) // safety net
} )
ok( winners === 1 && losers === 7,
  'exactly ONE of 8 concurrent claims must win, got ' + winners +
    ' winners (issue #9 race)' )
ok( fees.isUsed( RACE_ID ) === true, 'the race winner must be marked serviced' )

console.log( 'PASS race: 8 concurrent processes, exactly one claim wins' )

// ---------------------------------------------------------------------------

fs.rmSync( SCRATCH, { recursive: true, force: true } )
console.log( '\nAll fees tests passed. (' + passed + ' assertions passed)' )
})().catch( e => { console.error( e ); process.exit( 1 ) } )
