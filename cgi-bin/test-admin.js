// Unit check for the LAN gate that guards the local-only endpoints.
// No server or dependencies needed:  node cgi-bin/test-admin.js

const assert = require( 'node:assert' )
const admin = require( './admin.js' )

function check( addr, expected ) {
  process.env.REMOTE_ADDR = addr
  assert.strictEqual( admin.fromWithinLAN(), expected,
                      addr + ' => expected ' + expected )
}

// private / local — including the IPv4-mapped and bracketed forms a
// dual-stack listener (busybox httpd) actually exports
;[ '127.0.0.1', '::1', '::ffff:127.0.0.1', '[::ffff:127.0.0.1]',
   '10.0.0.5', '::ffff:10.0.0.5', '[::ffff:192.168.1.5]',
   '192.168.1.10', '172.16.0.1', '172.31.255.254', '169.254.1.1'
].forEach( a => check( a, true ) )

// public, malformed, and near-misses on the private ranges
;[ '203.0.113.9', '8.8.8.8',
   '172.15.0.1', '172.32.0.1', '192.169.1.1', '11.0.0.1', '126.0.0.1',
   '100.64.0.1',                       // CGNAT is not trusted by default
   '10.0.0.256', '1192.168.1.1', '10.1.1', '192.168.1.2.3',
   '10.0.0.1.example.com', 'not-an-ip', '', undefined
].forEach( a => check( a, false ) )

console.log( 'admin.fromWithinLAN: all cases pass' )
