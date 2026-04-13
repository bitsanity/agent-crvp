const fs = require( 'node:fs' )
const crypto = require( 'node:crypto' )
const secp256k1 = require( 'secp256k1' )
const adilos = require( 'adilosjs' )

function toFilename( chB64 ) {
  return './sessions/' + chB64
}

function writeSession( chall, data ) {
  let fname = toFilename( chall )
  fs.writeFileSync( fname, JSON.stringify(data), { encoding:'utf-8' } )
}

exports.getSession = function( challB64 ) {
  let fname = toFilename( challB64 )
  return JSON.parse( fs.readFileSync(fname, 'utf-8') )
}

exports.newSession = function() {
  let sessprivkey = new Uint8Array(32)
  crypto.getRandomValues( sessprivkey )
  let sesspubkey = Buffer.from( secp256k1.publicKeyCreate(sessprivkey, true) )

  let data = {
    created: Date.now(),

    privhex: Buffer.from( sessprivkey ).toString( 'hex' ),
    pubhex: sesspubkey.toString('hex'),

    chB64: adilos.makeChallenge( sessprivkey ),

    responded: null,
    clientpubkeyhex: null
  }

  writeSession( chall, data )

  return data
}

exports.responded = function( challB64, pubkeyhex ) {
  let sess = exports.getSession( challB64 )
  sess.responded = Date.now()
  sess.clientpubkeyhex = pubkeyhex

  writeSession( challB64, sess )
}

