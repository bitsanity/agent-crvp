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
  "orders" : true,
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
  let privkeyhex = process.env.AGENT_PRIVKEYHEX

  let redobj = ecjson.blackToRed( privkeyhex, blkobj )
  if (!redobj) {
    admin.respondHttp( 400, "signature validation/decryption failed" )
  }

  return redobj
}

async function processRequest( paramobj ) {

  let redobj

  if (paramobj && paramobj.msghex && paramobj.sighex && paramobj.spkhex) {
    screen( paramobj.spkhex )
    redobj = toRedObj( paramobj )
  }
  else {
    admin.responseHttp( 401, "body is missing authentication" )
  }

  if (!SERVICES[redobj.method])
    admin.responseHttp( 400, "method is not a recognized service" )

  let feeObj = fees.agentFee( redobj.method )

  if (feeObj.amt) {

    if (redobj.method === 'buy') {
      if (    !redobj.params
           || redobj.params.length != 1
           || redobj.params[0]
           || /^0x[0-9a-fA-F]{64}$/.test( redobj.params[0] )
         )
        admin.respondHttp( 400, "orderId param is missing or misformatted" )

      let order = await escrobot.orders( redobj.parms[0] )
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
    if (!cookie) admin.responseHttp( 402, JSON.stringify(feeObj) )

    let etxn = fees.getEthereumTxn( cookie )
    if (!etxn) admin.responseHttp( 400, "didnt find that txnhash" )

    if ( !fees.isFrom(etxn, paramobj.spkhex) )
      admin.responseHttp( 400, "payment must be from caller" )

    if ( !fees.isMined(etxn) ) admin.responseHttp( 102, "awaiting mining" )

    if ( !fees.isUsed(cookie) )
      admin.responseHttp( 400, "payment already serviced" )

    let checks = fees.checkSufficient( etxn, feeObj )
    if ( checks != null ) admin.responseHttp( 400, checks )

    fees.setUsed( cookie )

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

  // systems check steps

  if (!process.env.AGENT_PRIVKEYHEX)
    admin.respondHttp( 503, "agent config key missing" )

  if (!process.env.AGENT_ETH_ADDRESS)
    admin.respondHttp( 503, "agent eth address missing" )

  if (!process.env.ETHERSCAN_API_KEY)
    admin.respondHttp( 503, "etherscan api key missing" )

  // all encrequests are POST only

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

