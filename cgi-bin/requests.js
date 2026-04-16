
// NOTE:
//   - reqests database is a fileset with one file per client
//   - file contains an array of objects, each object is a request-result

const fs = require( 'node:fs' )
const path = require( 'path' )

const DIR = './requests'

function isString(val) {
  return Object.prototype.toString.call(val) === '[object String]';
}

function toFilename( pubkeyhex ) {
  return DIR + "/" + pubkeyhex
}

// returns JSON array
function readFile( pubkeyhex ) {
  try {
    let fname = toFilename( pubkeyhex )
    return JSON.parse( fs.readFileSync(fname, 'utf-8') )
  }
  catch (e) { }
  return null
}

function writeFile( pubkeyhex, dataobj ) {
  let fname = toFilename( pubkeyhex )
  fs.writeFileSync( fname, JSON.stringify(dataobj), { encoding:'utf-8' } )
}

function newFile( pubkeyhex ) {
  writeFile( pubkeyhex, [] )
}

function append( pubkeyhex, anobj ) {
  let reqarr = readFile( pubkeyhex )
  reqarr.push( anobj )
  writeFile( pubkeyhex, reqarr )
}

function replace( pubkeyhex, cookie, obj ) {
  let records = exports.all( pubkeyhex )
  if (!records || records.length == 0) throw 'record not found'

  let cookiestr = isString(cookie) ? cookie : JSON.stringify( cookie )

  for( let ii = 0; ii < records.length; ii++ ) {
    let rec = records[ii]
    if (    rec.redreq && rec.redreq.cookie
         && rec.redreq.cookie === cookiestr ) {
      records[ii] = obj
      return
    }
  }

  throw 'record not found'
}

exports.get = function( pubkeyhex, cookie ) {
  let records = readFile( pubkeyhex )
  if (!records || records.length == 0) return null

  let cookiestr = isString(cookie)
                  ? cookie
                  : JSON.stringify( cookie )

  for( let ii = 0; ii < records.length; ii++ ) {
    let rec = records[ii]

    if (    rec.redreq
         && rec.redreq.cookie
         && rec.redreq.cookie === cookiestr ) {
      return rec
    }
  }

  return null
}

exports.all = function( pubkeyhex ) {
  return readFile( pubkeyhex )
}


exports.add = function( pubkeyhex, reqobj ) {
  if (!readFile(pubkeyhex)) {
    newFile( pubkeyhex )
  }

  let data = {
    clientpubkeyhex: pubkeyhex,
    created: Date.now(),
    redreq: reqobj,
    redres: null,
    completed: null
  }

  append( pubkeyhex, data )
}

exports.setResult = function( pubkeyhex, cookie, resultobj ) {
  let rec = exports.get( pubkeyhex, cookie )
  if (!rec) throw 'request not found'

  rec.redres = resultobj
  rec.completed = Date.now()

  replace( pubkeyhex, cookie, rec )
}

exports.oldestPending = function() {

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
    let contents = exports.get( f )
    if (!contents.completed)
      result = contents
      break
    }
  }

  return result
}

