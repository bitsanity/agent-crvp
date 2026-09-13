#!/usr/bin/node --jitless

const HTTPRESPONSES = {
  102 : "Processing",
  200 : "OK",
  400 : "Bad Request",
  401 : "Unauthorized",
  402 : "Payment Required",
  403 : "Forbidden",
  404 : "Not Found",
  405 : "Method Not Allowed",
  500 : "Internal Server Error",
  502 : "Bad Gateway",
  503 : "Service Unavailable"
}



module.exports.respondHttp = function( statcode, content ) {
  // CGI header/body emission MUST go through process.stdout.write with exact
  // CRLF (\r\n) line endings and a byte-accurate Content-Length. console.log
  // writes LF-only lines plus a trailing newline, and embedding "\n" in the
  // Content-Type line breaks the HTTP/1.1 CRLF requirement — strict clients
  // (Node/Undici) reject such responses with HPE_INVALID_HEADER_TOKEN while
  // lenient ones (curl) accept them, so a request can be processed and then
  // appear to the caller as a transport failure.
  const isText  = typeof content === 'string' || content instanceof String
  const body    = isText ? String( content ) : JSON.stringify( content )
  const ctype   = isText ? 'text/plain' : 'application/json'

  process.stdout.write(
    'Status: ' + statcode + ' ' + HTTPRESPONSES[statcode] + '\r\n' +
    'Content-Type: ' + ctype + '\r\n' +
    'Content-Length: ' + Buffer.byteLength( body, 'utf8' ) + '\r\n' +
    '\r\n' +
    body
  )
  process.exit( 0 )
}


module.exports.parseGetParams = function( querystr ) {

  let reqobj = {}
  let args = querystr.split('&')

  for ( var ii = 0; ii < args.length; ii++ ) {
    let argpair = args[ii].split('=')
    let argname = argpair[0]
    let argval = decodeURIComponent( argpair[1] )
    reqobj[ argname ] = argval
  }

  return reqobj
}


// Is this address on a private/local network?
//
// Matched numerically (not by regex) over CIDR blocks so that IPv4-mapped
// IPv6 forms (`::ffff:10.0.0.5`) and the bracketed form busybox httpd exports
// (`[::ffff:10.0.0.5]`) are normalised first, and octets are range checked.
// The previous regex denied every mapped form, which meant that on a
// dual-stack listener the LAN-only endpoints rejected LAN clients outright.
//
// WARNING to operators: REMOTE_ADDR is the address of the immediate peer. If
// the CGI runs behind a reverse proxy, a load balancer, or a userland NAT
// proxy (e.g. Docker's default port publisher on some setups), the peer is
// that proxy — its address is typically 127.0.0.1 or 172.17.0.1, both of which
// are private, so *every* request from the public internet passes this check.
// The endpoints gated by fromWithinLAN() (adddid, register, getmenu,
// nextrequest, nexthello, nextanswer, obrequest, result) would then be world
// writable. Either terminate directly on the CGI host, or block those paths at
// the proxy. Do not rely on this check alone behind a proxy.
//
// CGNAT / Tailscale (RFC 6598 100.64.0.0/10) is NOT trusted by default: it is
// shared carrier-grade-NAT space, so a public client reached through a carrier
// NAT would also carry it. Set CARP_TRUST_CGNAT=1 in the CGI environment to
// admit it when you admin over Tailscale and are sure no public client can be
// aliased into that range.
function ipv4ToInt( addr ) {
  // returns signed 32-bit integer, or null if not dotted-quad / out of range
  let m = String( addr || '' ).match( /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/ )
  if ( !m ) return null
  let o = m.slice( 1 ).map( Number )
  if ( o.some( function( n ) { return n > 255 } ) ) return null
  return ((o[0] << 24) | (o[1] << 16) | (o[2] << 8) | o[3]) | 0
}

// CIDR string "a.b.c.d/prefix" -> true when addrInt is inside. Works over the
// IPv4 form only; callers normalise IPv4-mapped / bracketed forms first.
function inCidr( addrInt, cidr ) {
  let parts = cidr.split( '/' )
  let baseInt = ipv4ToInt( parts[0] )
  let prefix = parseInt( parts[1], 10 )
  if ( baseInt === null || Number.isNaN( prefix ) ) return false
  let mask = prefix === 0 ? 0 : ((-1) << (32 - prefix)) | 0
  return ( (addrInt & mask) === (baseInt & mask) )
}

const LAN_CIDRS = [
  '127.0.0.0/8',     // loopback
  '10.0.0.0/8',      // RFC 1918
  '172.16.0.0/12',   // RFC 1918 (incl. docker 172.17-31.x)
  '192.168.0.0/16',  // RFC 1918
  '169.254.0.0/16'   // link-local / APIPA
]

module.exports.isPrivateAddress = function( addr, opts ) {
  addr = String( addr || '' ).replace( /^\[|\]$/g, '' ).replace( /^::ffff:/, '' )

  if ( addr === '::1' ) return true   // IPv6 loopback

  let a = ipv4ToInt( addr )
  if ( a === null ) return false

  let cidrs = LAN_CIDRS.slice()
  if ( opts && opts.trustCgnat ) cidrs.push( '100.64.0.0/10' )  // RFC 6598/Tailscale

  return cidrs.some( function( c ) { return inCidr( a, c ) } )
}

module.exports.fromWithinLAN = function() {
  return module.exports.isPrivateAddress( process.env.REMOTE_ADDR, {
    trustCgnat: !!process.env.CARP_TRUST_CGNAT
  } )
}
