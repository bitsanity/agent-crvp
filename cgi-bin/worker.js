#!node

const session = require( './sessions.js' )
const ecjson = require( 'ecjsonrpc' )
const requests = require( './requests.js' )
const acl = require( './acl.js' )

function screen( pubkeyhex ) {

  let caller = acl.getRecord( pubkeyhex )
  if (!caller) {
    console.log( "Status: 401 Unauthorized" )
    console.log( "Content-Type: text/plain\r\n\r\n" )
    console.log( pubkeyhex + " is not on our ACL. Please register." )
    process.exit( 0 )
  }

  if (caller.bannedDate) {
    console.log( "Status: 403 Forbidden" )
    console.log( "Content-Type: text/plain\r\n\r\n" )
    console.log( pubkeyhex + " recognized, but banned due to: " +
                 caller.bannedReason )
    process.exit( 0 )
  }
}

function toRedObj( blkobj ) {
  let privkeyhex = process.env.AGENT_PRIVKEYHEX

  if (!privkeyhex) {
    console.log( "Status: 503 Service Unavailable" )
    console.log( "Content-Type: text/plain\r\n\r\n" )
    console.log( "maintenance required" )
    process.exit( 0 )
  }

  let redobj = ecjson.blackToRed( privkeyhex, blkobj )
  if (!redobj) {
    console.log( "Status: 400 Bad Request" )
    console.log( "Content-Type: text/plain\r\n\r\n" )
    console.log( "signature validation/decryption failed" )
    process.exit( 0 )
  }

  return redobj
}

function doAny( paramobj ) {

  let redobj

  if (paramobj.msghex) {
    screen( paramobj.spkhex )
    redobj = toRedObj( paramobj )
  }
  else {
    // anonymous unencrypted/red request object - do we just trust it?
    // TODO

    redobj = paramobj
  }

  // everything ok if we got this far add to request queue
  requests.add( paramobj.spkhex, redobj )

  console.log( "Status: 200 OK" )
  console.log( "Content-Type: text/plain" )
  console.log( "ACK" )
  process.exit( 0 )
}

function doGet() {

  let reqobj = {}
  let args = process.env.QUERY_STRING.split('&')

  for ( var ii = 0; ii < args.length; ii++ ) {
    let arg = args[ii].split('=')
    let argname = arg[0], argval = arg[1]
    reqobj[ argname ] = argval
  }

  doAny( reqobj ) 
}

function doPost() {

  process.stdin.on('data', data => {
    let body = JSON.parse( data.toString() )
    doAny( body )
  });

}

// handle receiving a request from another agent

module.exports.dorequest = function() {

  try {
    if (process.env.REQUEST_METHOD === 'GET') {
      doGet()
    }
    else if (process.env.REQUEST_METHOD === 'POST') {
      doPost()
    }
    else
      throw "unrecognized REQUEST_METHOD: " + process.env.REQUEST_METHOD
  }
  catch( ex ) {
    console.log( "Status: 400 Bad Request" )
    console.log( "Content-Type: text/plain\r\n\r\n" )
    console.log( ex.toString() )
  }

  process.exit( 0 )
}

// handle receiving the result of some request we sent to another agents
// web interface

module.exports.doresult = function() {

  // forward the result to our agent
  // TODO

}
