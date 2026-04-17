const fs = require( 'node:fs' )
const path = require( 'path' )

const crypto = require( 'node:crypto' )
const secp256k1 = require( 'secp256k1' )
const adilos = require( 'adilosjs' )

const DIR = './sessions/'

// Base64 encoding is not filename-friendly so we hash it to hex
function toFilename( chB64 ) {
  let hash = crypto.createHash('sha256')
  hash.update( chB64 )
  let fname = hash.digest('hex')
  return DIR + fname.substring(0,32)
}

function writeSession( chall, data ) {
  let fname = toFilename( chall )
  fs.writeFileSync( fname, JSON.stringify(data), { encoding:'utf-8' } )
}

exports.getSession = function( challB64 ) {
  let fname = toFilename( challB64 )
  return JSON.parse( fs.readFileSync(fname, 'utf-8') )
}

exports.removeSession = function( challB64 ) {
  let fname = toFilename( challB64 )
  fs.unlinkSync( fname )
}

exports.newSession = function() {
  // key not used for anything other than the challenge/response thats it
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

  writeSession( data.chB64, data )

  return data
}


exports.responded = function( challB64, pubkeyhex ) {
  let sess = exports.getSession( challB64 )
  sess.responded = Date.now()
  sess.clientpubkeyhex = pubkeyhex

  writeSession( challB64, sess )
}


exports.oldestValid = function() {

  const files =
    fs.readdirSync( DIR )
    .map(name => ({
      name,
      time: fs.statSync(path.join(dir, name)).mtime.getTime()
    }))
    .sort((a, b) => a.time - b.time) // oldest first
    .map(f => f.name);

  if (!files || files.length == 0) return null

  let result = null

  for (const f of files) {
    let contents = exports.getSession( f )
    if (contents.responsed && contents.clientpubkeyhex) {
      result = contents
      delete result.privhex
      delete result.pubhex
      break
    }
  }

  return result
}

