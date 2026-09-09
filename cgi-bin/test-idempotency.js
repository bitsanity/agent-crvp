#!/usr/bin/node --jitless
//
// Unit test for the correlation-ID / idempotency guard (issue #6 retry
// guidance). A request is identified by its JSON-RPC `id` (the "cookie").
// requests.add() must NOT enqueue a duplicate when the same client re-sends
// the same id (the exact scenario after a transport/parser failure followed
// by a retry that reuses the correlation id).
//
// Run:  /usr/bin/node --jitless test-idempotency.js

const assert = require( 'node:assert/strict' )
const fs     = require( 'node:fs' )
const os     = require( 'node:os' )
const path   = require( 'node:path' )
const crypto = require( 'node:crypto' )

// Point the requests store at a throwaway dir so we never touch the live
// ./requests/ in the CGI tree. requests.js reads its DIR at require time.
let tmpdir = fs.mkdtempSync( path.join( os.tmpdir(), 'carp-idem-' ) )
process.chdir( tmpdir )
fs.mkdirSync( path.join( tmpdir, 'requests' ) )

const requests = require( './requests.js' )

let pass = 0
function ok( label, cond ) {
  assert.ok( cond, label )
  console.log( '  pass  ' + label )
  pass++
}

const PUB = '03' + 'ab'.repeat(32)   // arbitrary 33-byte hex pubkey

function req( id ) {
  return { jsonrpc: '2.0', method: 'timenow', params: [], id }
}

console.log( 'test-idempotency: requests.add dedupes on correlation id' )

// First submission enqueues a fresh, pending record.
let a1 = requests.add( PUB, req( 'correl-1' ) )
ok( 'first add returns a new pending record', a1 && a1.completed === null && a1.redreq.id === 'correl-1' )

// A retry with the SAME id must not enqueue a duplicate.
let a2 = requests.add( PUB, req( 'correl-1' ) )
ok( 'retry with same id returns a record for that id', a2 && a2.redreq && a2.redreq.id === 'correl-1' )
ok( 'retry returns the correlation id untouched', a2.redreq.id === a1.redreq.id )
ok( 'only one record after retry', requests.all( PUB ).length === 1 )

// A retry after the action was completed is also idempotent.
requests.setResult( PUB, 'correl-1', { answer: 'already done' } )
let a3 = requests.add( PUB, req( 'correl-1' ) )
ok( 'retry after completion returns the completed record', a3.completed !== null && a3.redres.answer === 'already done' )
ok( 'still only one record', requests.all( PUB ).length === 1 )

// A DIFFERENT id is a distinct operation and is enqueued.
requests.add( PUB, req( 'correl-2' ) )
ok( 'different id enqueued separately', requests.all( PUB ).length === 2 )
ok( 'second record pending', requests.all( PUB )[1].redreq.id === 'correl-2' && requests.all( PUB )[1].completed === null )

// A request without an id (rare) must still enqueue (no dedupe possible).
requests.add( PUB, req( undefined ) )
ok( 'id-less request still enqueues', requests.all( PUB ).length === 3 )

console.log( '\ntest-idempotency: ALL PASS (' + pass + ' checks)\n' )

// cleanup
fs.rmSync( tmpdir, { recursive: true, force: true } )