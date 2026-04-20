// text files are named according the the id (a cookie) in the red obj

const crypto = require( 'node:crypto' )
const fs = require( 'node:fs' )
const path = require( 'path' )

const DIR = './answers/'

function toFilename( idcookie ) {
  let hash = crypto.createHash('sha256')
  hash.update( idcookie )
  let fname = hash.digest('hex')
  return DIR + fname.substring(0,32)
}

// returns JSON, the result from the redobj
function readFile( idcookie ) {
  try {
    let fname = toFilename( idcookie )
    return JSON.parse( fs.readFileSync(fname, 'utf-8') )
  }
  catch (e) { }
  return null
}

function writeFile( idcookie, dataobj ) {
  let fname = toFilename( idcookie )
  fs.writeFileSync( fname, JSON.stringify(dataobj), { encoding:'utf-8' } )
}

exports.enqueue = function( idcookie, anobj ) {
  writeFile( idcookie, anobj )
}

exports.dequeue = function() {

  const files =
    fs.readdirSync( DIR )
    .map(name => ({
      name,
      time: fs.statSync(path.join(dir, name)).mtime.getTime()
    }))
    .sort((a, b) => a.time - b.time) // oldest first
    .map(f => f.name);

  if (!files || files.length == 0) return null

  let result = readFile( f )
  fs.unlinkSync( f )
  return result
}

