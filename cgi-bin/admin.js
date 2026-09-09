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
  console.log( "Status: " + statcode + " " + HTTPRESPONSES[statcode] )

  console.log( "Status: " + statcode + " " + HTTPRESPONSES[statcode] )

  if (typeof content === 'string' || content instanceof String) {
    console.log( "Content-Type: text/plain\n" )
    console.log( content )
  }
  else {
    console.log( "Content-Type: application/json\n" )
    console.log( JSON.stringify(content) )
  }
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
// Parsed numerically rather than by regex so that IPv4-mapped IPv6 forms
// (`::ffff:10.0.0.5`) and the bracketed form busybox httpd exports
// (`[::ffff:10.0.0.5]`) are normalised first, and so that octets are range
// checked. The previous regex denied every mapped form, which meant that on a
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
// Deployments that admin over a VPN (WireGuard, Tailscale/CGNAT 100.64.0.0/10,
// etc.) should add that range here — it is deliberately not trusted by default.
function isPrivateAddress( addr ) {
  addr = String( addr || '' ).replace( /^\[|\]$/g, '' ).replace( /^::ffff:/, '' )

  if ( addr === '::1' ) return true                                // IPv6 loopback

  let m = addr.match( /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/ )
  if ( !m ) return false

  let o = m.slice( 1 ).map( Number )
  if ( o.some( function( n ) { return n > 255 } ) ) return false

  if ( o[0] === 127 ) return true                                  // 127.0.0.0/8
  if ( o[0] === 10 ) return true                                   // 10.0.0.0/8
  if ( o[0] === 192 && o[1] === 168 ) return true                  // 192.168.0.0/16
  if ( o[0] === 172 && o[1] >= 16 && o[1] <= 31 ) return true      // 172.16.0.0/12
  if ( o[0] === 169 && o[1] === 254 ) return true                  // 169.254.0.0/16

  return false
}

module.exports.isPrivateAddress = isPrivateAddress

module.exports.fromWithinLAN = function() {
  return isPrivateAddress( process.env.REMOTE_ADDR )
}
