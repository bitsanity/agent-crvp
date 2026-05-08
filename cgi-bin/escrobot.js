const { ethers } = require( 'ethers' )
const env = require( './env.js' )

exports.getorder = async function( orderidbytes32hex ) {
  let fres = await fetch(
    "https://api.etherscan.io/v2/api?" +
    "apikey=" + env.VARS.ETHERSCAN_API_KEY +
    "&chainid=1" +
    "&module=proxy" +
    "&action=eth_call" +
    "&to=" + env.VARS.ESCROBOT_SCA +
    "&data=0x9c3f1e90" + orderidbytes32hex )

  let jres = await fres.json()

  return jres.result
}

exports.myorders = async function( pubkeyhex ) {
  let addr = ethers.computeAddress( '0x' + pubkeyhex )
  let topic0 = ethers.id( "Submitted(bytes32,address)" )
  let topic2 = '0x000000000000000000000000' + addr.substring(2)

  let fres = await fetch(
    "https://api.etherscan.io/v2/api?" +
    "apikey=" + env.VARS.ETHERSCAN_API_KEY +
    "&chainid=1" +
    "&module=logs" +
    "&action=getLogs" +
    "&fromBlock=25040525" +
    "&toBlock=latest" +
    "&address=" + env.VARS.ESCROBOT_SCA +
    "&topic0=" + topic0 +
    "&topic2=" + topic2 )

  let jres = await fres.json()
  let evts = jres.result

  let orderids = []

  evts.forEach( evt => {
    orderids.push( evt.result.topics[1] )
  } )

  return orderids
}

