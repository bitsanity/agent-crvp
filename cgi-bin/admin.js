#!/usr/bin/node

const HTTPRESPONSES = {
  200 : "OK",
  400 : "Bad Request",
  401 : "Unauthorized",
  402 : "Payment Required",
  403 : "Forbidden",
  404 : "Not Found",
  405 : "Method Not Allowed",
  500 : "Internal Server Error",
  503 : "Service Unavailable"
}

const LOCAL_IP_REGEX = /^(?:10\.|127\.|169\.254\.|172\.(?:1[6-9]|2\d|3[0-1])\.|192\.168\.)(?:\d{1,3}\.){1,2}\d{1,3}$/


module.exports.respondHttp = function( statcode, content ) {
  console.log( "HTTP/1.1 " + statcode + " " + HTTPRESPONSES[statcode] )
  console.log( "Content-Type: text/plain" )
  console.log( content )
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


module.exports.fromWithinLAN = function() {
  return LOCAL_IP_REGEX.test( process.env.REMOTE_ADDR )
}
