const fs = require( 'node:fs' )

function toFilename( pubkeyhex ) {
  return './acl/' + pubkeyhex
}

function writeRecord( pubkeyhex, data ) {
  let fname = toFilename( pubkeyhex )
  fs.writeFileSync( fname, JSON.stringify(data) + '\n', { encoding:'utf-8' } )
}

exports.getRecord = function( pubkeyhex ) {
  let fname = toFilename( pubkeyhex )
  if (fs.existsSync(fname))
    return JSON.parse( fs.readFileSync(fname, 'utf-8') )
  return null
}

exports.newEntry = function( pubkeyhex ) {
  let data = {
    created: Date.now(),
    bannedDate: null,
    banReason: null
  }

  writeRecord( pubkeyhex, data )
  return data
}

exports.addDID = function( didobj ) {
  let rec = exports.getRecord( didobj.pubkeyhex )
  if (!rec) rec = exports.newEntry( didobj.pubkeyhex )
  rec.did = didobj
  writeRecord( didobj.pubkeyhex, rec )
}

exports.pubkeyToHostPort = function( pubkeyhex ) {
  let rec = exports.getRecord( pubkeyhex )
  if (rec && rec.did)
    return rec.did.url || rec.did.carp_url

  return null
}

exports.ban = function( pubkeyhex, reason ) {
  let it = exports.getRecord( pubkeyhex )
  it.bannedDate = Date.now()
  it.bannedReason = reason

  writeRecord( pubkeyhex, it )
}
