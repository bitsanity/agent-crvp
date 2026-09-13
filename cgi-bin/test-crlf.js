#!/usr/bin/node --jitless
//
// Regression test for https://github.com/bitsanity/agent-crvp/issues/6
//
// The bug: agent-crvp CGI responses were built with console.log() and embedded
// "\n" in the Content-Type line, producing LF-only headers and no Content-
// Length. Strict HTTP clients (Node/Undici) reject such responses with
// HPE_INVALID_HEADER_TOKEN while lenient ones (curl) accept them, so a request
// could be processed yet appear to the caller as a transport failure.
//
// This is a CGI-output-level check, NOT an end-to-end fetch: many web servers
// (e.g. lighttpd) silently rebuild the header block with CRLF, which would make
// a HTTP-fetch regression test pass even with the bug present — that is exactly
// why it slipped through to BusyBox httpd. We therefore capture the raw
// bytes of the shared response helper and assert the transport contract
// directly:
//
//   * every header/status line ends in CRLF (\r\n), never a bare LF,
//   * the header block is followed by a single blank CRLF line,
//   * Content-Length is present and byte-exact for UTF-8,
//   * console.log-style accidental output (a bare trailing "\n") is absent.
//
// Run:  /usr/bin/node --jitless test-crlf.js
// Test is green ("ALL PASS") when every assertion holds.

const assert = require( 'node:assert/strict' )
const admin  = require( './admin.js' )

let pass = 0

function check( label, statcode, content, expectCType ) {
  // respondHttp writes to process.stdout and calls process.exit(0); capture the
  // write and stub out exit so we can inspect the exact bytes.
  const chunks = []
  const realWrite = process.stdout.write
  const realExit  = process.exit
  process.stdout.write = ( c ) => { chunks.push( c ); return true }
  process.exit = () => { throw new Error( '__EXIT' ) }

  let threwExit = false
  try {
    admin.respondHttp( statcode, content )
  } catch ( e ) {
    if ( e.message === '__EXIT' ) threwExit = true
    else throw e
  } finally {
    process.stdout.write = realWrite
    process.exit = realExit
  }
  assert.ok( threwExit, label + ': respondHttp must terminate (process.exit)' )

  const raw = chunks.join( '' )
  const hdrEnd = raw.indexOf( '\r\n\r\n' )
  assert.ok( hdrEnd !== -1, label + ': header block must end in CRLF CRLF' )

  const headerBlock = raw.slice( 0, hdrEnd )
  const body        = raw.slice( hdrEnd + 4 )

  const expectedBody = (typeof content === 'string' || content instanceof String)
    ? String( content )
    : JSON.stringify( content )
  assert.equal( Buffer.byteLength( body, 'utf8' ),
                Buffer.byteLength( expectedBody, 'utf8' ),
                label + ': body bytes must match serialized content' )

  // No bare LF in the header block (a bare "\n" not preceded by "\r"; note a
  // legitimate CRLF itself contains "\n", so check the lookbehind carefully).
  assert.ok( !/(?<!\r)\n/.test( headerBlock ),
             label + ': header block must contain no bare LF (every line CRLF-terminated)' )

  // Every header line uses CRLF.
  assert.ok( headerBlock.split( '\r\n' ).every( ( l, i, a ) =>
                l.length > 0 || i === a.length - 1 ),
             label + ': header lines CRLF-terminated' )

  const status = headerBlock.match( /^Status:\s*(\d+)/ )
  assert.ok( status, label + ': header block must begin with a Status line' )
  assert.equal( Number( status[1] ), statcode,
                label + ': Status code matches' )

  const ctype = headerBlock.match( /^Content-Type:\s*(\S+)\s*$/m )
  assert.ok( ctype, label + ': Content-Type present' )
  assert.equal( ctype[1], expectCType, label + ': Content-Type value' )

  const clen = headerBlock.match( /^Content-Length:\s*(\d+)\s*$/m )
  assert.ok( clen, label + ': Content-Length present' )
  assert.equal( Number( clen[1] ),
                Buffer.byteLength( expectedBody, 'utf8' ),
                label + ': Content-Length byte-exact' )

  const bytes = Buffer.from( raw, 'utf8' )
  const hexPair = bytes.slice( 0, raw.includes( '\r\n\r\n' )
                                  ? raw.indexOf( '\r\n\r\n' ) + 4 : 0 )
                      .toString( 'hex' )
  assert.ok( hexPair.includes( '0d0a' ), label + ': contains CRLF bytes (0d0a)' )

  console.log( '  pass  ' + label + '  [HTTP ' + statcode + ', ' + expectCType + ']' )
  pass++
}

function main() {
  console.log( 'test-crlf: checking respondHttp emits RFC-7230-compliant CGI output' )

  check( 'text/plain body',   200, 'OK',                              'text/plain' )
  check( 'json object body',  200, { did: 'x', n: 1 },                'application/json' )
  check( 'utf8 body bytes',   200, 'héllo→世界',                        'text/plain' )
  check( 'status 401',        401, 'local only',                      'text/plain' )
  check( 'status 405',        405, 'Please use GET',                  'text/plain' )
  check( 'nested json',       200, { result: { challenge: 'c2lk' } }, 'application/json' )

  console.log( '\ntest-crlf: ALL PASS (' + pass + ' checks)\n' )
}

try {
  main()
} catch ( e ) {
  console.error( '\ntest-crlf: FAILED ->', e.message )
  if ( e.code ) console.error( '             value:', e.actual, '(expected', e.expected + ')' )
  process.exit( 1 )
}