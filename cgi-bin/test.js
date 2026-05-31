const adilos = require( 'adilosjs' )
const ecjson = require( 'ecjsonrpc' )
const env = require( './env.js' )
const worker = require( './worker.js' )

const TESTURL = "http://127.0.0.1:8888"
const TESTKEY = {
  "prv": "17ec69dffe7f0f6f12c5de07ff04a6cd89212cf52d324a234203e81bef045495",
  "pub": "04126c46b0c631d44c38d202ae873f2da33c9251879a6fdd903c1122022bbc5cfc6f665eb4f74133305ba34045dba09edd4cf7f64b679b936016fa747ad1fb427f"
}

async function GET( url, headers, paramobj ) {

  if (paramobj) {
    url += '?'
    Object.keys( paramobj ).forEach( key => {
      full += key + "=" + paramobj[key] + "&"
    } )
  }

  let rsp = await fetch( url, { method: "GET", headers: headers } )

  if (!rsp.ok) throw "bad GET response: " + rsp.status
  let result = await rsp.json()
  return result
}

async function POST( url, headers, paramobj ) {
  let rsp = await fetch( url, {
    method: "POST",
    headers: headers,
    body: JSON.stringify(paramobj)
  } )
  if (!rsp.ok) throw "bad POST response: " + JSON.stringify(rsp)
  let result = await rsp.json()
  return result
}

async function asyncmain() {

  const NULLHEAD = {}

  //
  // basics
  //

  let tn = await GET( TESTURL + '/cgi-bin/timenow', NULLHEAD, null )
  console.log( '\ntimenow: ' + tn )

  let did = await GET( TESTURL + '/cgi-bin/did', NULLHEAD, null )

  console.log( '\n' + JSON.stringify(did) )

  //
  // introductions
  //

  let challres = await GET( TESTURL + '/cgi-bin/challenge', NULLHEAD, null )
  let chall = challres.result.challenge

  console.log( '\ngot challenge: ' + chall )

  let challresp = adilos.makeResponse( chall, Buffer.from(TESTKEY.prv,'hex') )

  try {
    let bo = {
      rsp: challresp,
      chall: chall
    }

    console.log( '\nmy response: ' + JSON.stringify(bo) )

    let loginresp = await POST( TESTURL + "/cgi-bin/response", NULLHEAD, bo )

    console.log( '\nlogin result: ' + JSON.stringify(loginresp) )
  } catch (e) {
    console.log( e.toString() )
  }

  // playing the agent - periodically retrieve the next hello (FIFO)

  let nexthello = await GET( TESTURL + '/cgi-bin/nexthello', NULLHEAD, null )
  console.log( '\nnext hello: ' + JSON.stringify(nexthello,null,2) )

  //
  // simplest encrypted scenario, synchronous
  //

  let red = {
    jsonrpc: "2.0",
    method: "myorders",
    params: [],
    id: "ice-cream-cookie"
  }

  let black = ecjson.redToBlack( TESTKEY.prv, env.VARS.AGENT_PUBKEY, red )

  let myorders = await POST( TESTURL + '/cgi-bin/encrequest', NULLHEAD, black )

  console.log( '\nmyorders: ' + JSON.stringify(myorders) )

  //
  // core business stuff
  //

  let redsubreq = {
    jsonrpc: "2.0",
    method: "submit",
    params: [
      "left-handed-widget", // description
      "1000000000000000",   // price
      "0",                  // ETH
      "1000000000000000",   // bond
      "1000"                // timeoutblocks
    ],
    "id": "<0xtrustmebro>"
  }

  let blksubreq =
    ecjson.redToBlack( TESTKEY.prv, env.VARS.AGENT_PUBKEY, redsubreq )

  worker.processRequest( blksubreq )

  let blksubrsp =
    await POST( TESTURL + '/cgi-bin/encrequest', NULLHEAD, blksubreq )

  // playing the agent now

  let nextrequest =
    await GET( TESTURL + '/cgi-bin/nextrequest', NULLHEAD, null )

  console.log( '\nnextrequest: ' + JSON.stringify(nextrequest,null,2) )

  let redrsp = {
    jsonrpc: "2.0",
    result: {
      answer: "did something",
      quantity: 42
    },
    id: "oatmeal-cookie"
  }

  let result = await POST( TESTURL + '/cgi-bin/result', {
      'Content-Type': 'application/json',
      'Cookie': 'to=' + TESTKEY.pub + ';' + 'cookie=oatmeal-cookie'
    }, redrsp )

}

//
// the main MAIN
//

try {
  asyncmain()
}
catch( e ) {
  console.log( e.toString() )
}

