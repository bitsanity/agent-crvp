const fs = require( 'node:fs' )

function toFilename( pubkeyhex ) {
  return './acl/' + pubkeyhex
}

function writeRecord( pubkeyhex, data ) {
  let fname = toFilename( pubkeyhex )
  fs.writeFileSync( fname, JSON.stringify(data), { encoding:'utf-8' } )
}

exports.getRecord = function( pubkeyhex ) {
  let fname = toFilename( pubkeyhex )
  return JSON.parse( fs.readFileSync(fname, 'utf-8') )
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

exports.ban = function( pubkeyhex, reason ) {
  let it = exports.getRecord( pubkeyhex )
  it.bannedDate = Date.now()
  it.bannedReason = reason

  writeRecord( pubkeyhex, it )
}

