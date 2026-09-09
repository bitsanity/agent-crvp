#!/usr/bin/node --jitless
//
// Unit tests for LAN detection, covering issue #6 secondary finding:
//   * RFC 1918 private ranges,
//   * IPv4-mapped IPv6 forms (::ffff:10.0.0.5) and the bracketed form
//     ([::ffff:...]) that busybox httpd exports,
//   * loopback + link-local (APIPA),
//   * CGNAT / Tailscale 100.64.0.0/10 -- trusted only when opts.trustCgnat,
//   * public addresses rejected,
//   * malformed / non-dotted-quad addresses rejected.
//
// Run:  /usr/bin/node --jitless test-lan.js

const assert = require( 'node:assert/strict' )
const admin  = require( './admin.js' )

let pass = 0

function check( label, addr, expected, opts ) {
  let got = admin.isPrivateAddress( addr, opts )
  assert.equal( got, expected,
                label + ': expected ' + expected + ' for ' + JSON.stringify(addr) + ' (got ' + got + ')' )
  console.log( '  pass  ' + label + '  ' + JSON.stringify( addr ) + ' -> ' + expected )
  pass++
}

console.log( 'test-lan: isPrivateAddress LAN/private-range detection' )

// RFC 1918 + loopback + link-local
check( 'loopback',                '127.0.0.1',             true  )
check( 'loopback 127.x',          '127.255.255.254',       true  )
check( 'class A 10/8',            '10.9.8.7',              true  )
check( 'class B 172.16/12 min',   '172.16.0.0',            true  )
check( 'class B 172.31/12 max',   '172.31.255.255',        true  )
check( 'docker 172.17',           '172.17.0.1',            true  )
check( 'class C 192.168/16',      '192.168.1.1',           true  )
check( 'link-local 169.254/16',   '169.254.169.254',       true  )

// public addresses rejected
check( 'public 8.8.8.8',          '8.8.8.8',               false )
check( 'public 172.32 not 172.16', '172.32.0.1',           false )  // outside 172.16/12
check( 'public 192.169',          '192.169.1.1',           false )  // just after 192.168/16
check( 'public 11.0.0.1',         '11.0.0.1',              false )  // just after 10/8

// IPv4-mapped IPv6 and bracketed forms (the original bug)
check( 'v4-mapped 10/8',          '::ffff:10.0.0.5',       true  )
check( 'v4-mapped 192.168',       '::ffff:192.168.1.1',    true  )
check( 'v4-mapped 172.17 docker', '::ffff:172.18.0.1',     true  )
check( 'v4-mapped 8.8.8.8 pub',   '::ffff:8.8.8.8',        false )
check( 'bracketed v4-mapped',     '[::ffff:10.0.0.5]',     true  )
check( 'plain bracketed',         '[10.0.0.5]',            true  )

// CGNAT / Tailscale 100.64.0.0/10
check( 'cgnat refused by default', '100.64.0.1',           false )
check( 'cgnat refused default2',   '100.127.255.254',      false )
check( 'cgnat trusted via opt',    '100.64.0.1',           true,
       { trustCgnat: true } )
check( 'cgnat high end trusted',   '100.127.255.254',      true,
       { trustCgnat: true } )
check( 'cgnat 100.128 refused',    '100.128.0.1',          false,
       { trustCgnat: true } )        // 100.64/10 ends at 100.127.255.255

// IPv6 loopback and malformed input
check( 'ipv6 loopback',           '::1',                   true  )
check( 'empty string',            '',                      false )
check( 'non-ip string',           'not-an-ip',             false )
check( 'octet overflow 256',      '256.1.1.1',             false )
check( 'short 3 octets',          '1.2.3',                 false )
check( 'null',                    null,                    false )
check( 'undefined',               undefined,               false )

console.log( '\ntest-lan: ALL PASS (' + pass + ' checks)\n' )