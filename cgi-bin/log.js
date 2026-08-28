const fs = require( 'node:fs' )
const path = require( 'node:path' )

const DIR = path.join( __dirname, 'events' )
const LOGFILE = path.join( DIR, 'agent.jsonl' )

// Append-only interaction log. Logging failures must never break the
// request path, so every failure here is swallowed.
exports.append = function( event, extra ) {
  try {
    if (!fs.existsSync(DIR)) fs.mkdirSync( DIR, { recursive: true } )
    let rec = Object.assign(
      { ts: Date.now(), ip: process.env.REMOTE_ADDR || '', event: event },
      extra || {}
    )
    fs.appendFileSync( LOGFILE, JSON.stringify(rec) + '\n' )
  }
  catch (e) { /* best-effort only */ }
}

// Read the log, newest first, bounded so callers (admin/network) never
// have to load an unbounded file into memory.
exports.read = function( limit ) {
  try {
    let lines = fs.readFileSync( LOGFILE, 'utf-8' ).trim().split('\n').filter(Boolean)
    let out = []
    for (let ii = lines.length - 1; ii >= 0 && out.length < (limit || 500); ii--) {
      try { out.push( JSON.parse(lines[ii]) ) } catch (e) {}
    }
    return out
  }
  catch (e) { return [] }
}
