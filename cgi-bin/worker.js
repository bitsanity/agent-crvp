const env = require( './env.js' )
const session = require( './sessions.js' )
const ecjson = require( 'ecjsonrpc' )
const requests = require( './requests.js' )
const answers = require( './answers.js' )
const acl = require( './acl.js' )
const admin = require( './admin.js' )
const fees = require( './fees.js' )
const escrobot = require( './escrobot.js' )

const SERVICES = {
  "timenow" : true,
  "encrypted-async-time-now" : true,
  "myorders" : true,
  "submit" : true,
  "buy" : true,
  "timeout" : true,
  "ship" : true,
  "confirm" : true,
  "note" : true,
  "arbitration" : true
}

function screen( pubkeyhex ) {

  let caller = acl.getRecord( pubkeyhex )
  if (!caller) {
    admin.respondHttp( 401, "Please register first." )
  }

  if (caller.bannedDate) {
    admin.respondHttp( 403, "recognized, but banned" )
  }
}

function toRedObj( blkobj ) {
  let privkeyhex = env.VARS.AGENT_PRIVKEYHEX
  if (!privkeyhex) admin.respondHttp( 500, "config: agent key" )

  let redobj = ecjson.blackToRed( privkeyhex, blkobj )
  if (!redobj) {
    admin.respondHttp( 400, "signature validation/decryption failed" )
  }

  return redobj
}

exports.processRequest = async function ( paramobj ) {

  let redobj

  if (paramobj && paramobj.msghex && paramobj.sighex && paramobj.spkhex) {
    screen( paramobj.spkhex )
    redobj = toRedObj( paramobj )
  }
  else {
    admin.respondHttp( 401, "body is missing authentication" )
  }

  if (!SERVICES[redobj.method])
    admin.respondHttp( 400, "method is not a recognized service" )

  if (redobj.method === 'myorders') {
    try {
      let ords = await escrobot.myorders( paramobj.spkhex )
      admin.respondHttp( 200, ords )
    }
    catch( e ) {
      admin.respondHttp( 500, e.toString() )
    }
  }

  if (redobj.method === 'getorder') {
    try {
      let ord = await escrobot.getorder( redobj.params[0] )
      admin.respondHttp( 200, ord )
    }
    catch( e ) {
      admin.respondHttp( 500, e.toString() )
    }
  }

  let feeObj = fees.agentFee( redobj.method )

  if (feeObj && feeObj.amt) {

    if (redobj.method === 'buy') {
      let orderid = "" + redobj.params[0]

      if (! /^0x[0-9a-fA-F]{64}$/.test(orderid))
        admin.respondHttp( 400, "orderId param is missing or misformatted" )

      let order = await escrobot.getorder( orderid )
      if (!order) admin.respondHttp( 400, "orderId unrecognized" )

      if (order.token == 0) {
        feeObj.amt += order.price + order.bond
      }
      else {
        feeObj.token = order.token
        feeObj.tokenunits = order.price + order.bond
      }
    }

    let cookie = redobj.id
    if (!cookie) admin.respondHttp( 402, feeObj )

    try {
      let etxn = await fees.getEthereumTxn( cookie )

      if (!etxn || !etxn.from)
        admin.respondHttp( 400, "didnt find that txnhash" )

      if ( !fees.isFrom(etxn, paramobj.spkhex) )
        admin.respondHttp( 400, "payment must be from caller" )

      if ( !fees.isMined(etxn) ) admin.respondHttp( 102, "awaiting mining" )

      if ( fees.isUsed(cookie) )
        admin.respondHttp( 400, "payment already serviced" )

      let checks = fees.checkSufficient( etxn, feeObj )
      if ( checks != null ) admin.respondHttp( 400, checks )

      fees.setUsed( cookie )
    }
    catch( ex ) {
      admin.respondHttp( 500, ex.toString() )
    }

  } // end if fee required

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

  // systems check

  if (    !env.VARS.AGENT_PRIVKEYHEX
       || !env.VARS.AGENT_ETH_ADDRESS
       || !env.VARS.ETHERSCAN_API_KEY )
    admin.respondHttp( 503, "config missing" )

  // all encrequests are POST only

  if (process.env.REQUEST_METHOD !== 'POST') {
    admin.respondHttp( 405, "POST only" )
  }

  process.stdin.on( 'data', data => {
    let body = JSON.parse( data.toString() )
    exports.processRequest( body )
  } )

}

// handle receiving the result of some request we sent to another agent

module.exports.doresult = function() {

  // all encresults are POST 
  if (process.env.REQUEST_METHOD !== 'POST') {
      admin.respondHttp( 405, "POST only" )
  }

  process.stdin.on( 'data', data => {
    let body = JSON.parse( data.toString() )
    processAnswer( body )
  } )

}

