const fs = require( 'node:fs' )
const path = require( 'path' )

const crypto = require( 'node:crypto' )
const secp256k1 = require( 'secp256k1' )
const adilos = require( 'adilosjs' )

const DIR = './sessions/'

// Base64 encoding is not filename-friendly so we hash it to hex
function toFilename( chB64 ) {
  console.log( 'toFilename: ' + chB64 )

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

  let pubkeyshort =
    secp256k1.publicKeyConvert( Buffer.from(pubkeyhex,'hex'), true )

  let pubkeybuff = Buffer.from( pubkeyshort )
  sess.clientpubkeyhex = pubkeybuff.toString('hex')

  writeSession( challB64, sess )
}


exports.oldestValid = function() {

  const files =
    fs.readdirSync( DIR )
    .map(name => ({
      name,
      time: fs.statSync(path.join(DIR, name)).mtime.getTime()
    }))
    .sort((a, b) => a.time - b.time) // oldest first
    .map(f => f.name);

  if (!files || files.length == 0) return null

  let result = null

  for (const f of files) {
    let fp = DIR + '/' + f
    let rec = JSON.parse( fs.readFileSync(fp, 'utf-8' ) )

    if (rec.responded && rec.clientpubkeyhex) {
      result = rec
      delete result.privhex
      delete result.pubhex
      fs.unlinkSync( fp )
      break
    }
  }

  return result
}

