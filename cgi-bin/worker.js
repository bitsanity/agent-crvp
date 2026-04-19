#!node

const session = require( './sessions.js' )
const ecjson = require( 'ecjsonrpc' )
const requests = require( './requests.js' )
const answers = require( './answers.js' )
const acl = require( './acl.js' )
const admin = require( './admin.js' )

function screen( pubkeyhex ) {

  let caller = acl.getRecord( pubkeyhex )
  if (!caller) {
    admin.respondHttp( 401, " not on ACL. Please register." )
  }

  if (caller.bannedDate) {
    admin.respondHttp( 403, "recognized, but banned" )
  }
}

function toRedObj( blkobj ) {
  let privkeyhex = process.env.AGENT_PRIVKEYHEX

  if (!privkeyhex) {
    admin.respondHttp( 503, "maintenance required" )
  }

  let redobj = ecjson.blackToRed( privkeyhex, blkobj )
  if (!redobj) {
    admin.respondHttp( 400, "signature validation/decryption failed" )
  }

  return redobj
}

function processRequest( paramobj ) {

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

  // if this is a payable request then confirm the cookie is a valid payment
  // receipt
  // TODO
  let cookie = redobj.id

  // everything ok if we got this far add to request queue
  requests.add( paramobj.spkhex, redobj )

  admin.respondHttp( 200, "ACK" )
}

function processAnswer( blkobj ) {
  try {
    let redobj = toRedObj( blkobj )
    redobj.sender = blkobj.spkhex

    if (redobj.result) {
      redobj.result.id = redobj.id
      answers.enqueue( redobj.id, redobj.result )
    }
    else if (redobj.error) {
      redobj.error.id = redobj.id
      answers.enqueue( redobj.id, redobj.error )
    }
    else
      admin.respondHttp( 400, "message must include result or error" )
  }
  catch( ex ) {
    admin.respondHttp( 500, ex.getMessage() )
  }

  admin.respondHttp( 200, "ACK" )
}

// handle receiving a request from another agent

module.exports.dorequest = function() {

  // all encrequests are POST 
  if (process.env.REQUEST_METHOD !== 'POST') {
      admin.responseHttp( 405, "POST only" )
  }

  process.stdin.on( 'data', data => {
    let body = JSON.parse( data.toString() )
    processRequest( body )
  } )

}

// handle receiving the result of some request we sent to another agent

module.exports.doresult = function() {

  // all encresults are POST 
  if (process.env.REQUEST_METHOD !== 'POST') {
      admin.responseHttp( 405, "POST only" )
  }

  process.stdin.on( 'data', data => {
    let body = JSON.parse( data.toString() )
    processAnswer( body )
  } )

}

