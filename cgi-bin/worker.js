const env = require( './env.js' )
const session = require( './sessions.js' )
const ecjson = require( 'ecjsonrpc' )
const requests = require( './requests.js' )
const answers = require( './answers.js' )
const acl = require( './acl.js' )
const admin = require( './admin.js' )
const fees = require( './fees.js' )
const sads = require( './sads.js' )
const reply = require( './reply.js' )
const waku = require( './waku.js' )
const fs = require( 'node:fs' )

// Concierge.about: free, editable blurb any account can update in place.
// Lives at the repo root and is read fresh on every request, so edits to the
// file show up immediately with no redeploy.
const ABOUT_FILE = './concierge.about.txt'

const SERVICES = {
  "timenow" : true,
  "encrypted-async-timenow" : true,

  "about" : true,
  "agents" : true,
  "roles" : true,
  "join" : true,
  "rent" : true,
}

function screen( pubkeyhex ) {

  let caller = acl.getRecord( pubkeyhex )
  if (!caller) {
    admin.respondHttp( 401, "Please register first." )
  }

  if (caller.bannedDate) {
    admin.respondHttp( 403, "recognized, but banned" )
  }
}

function toRedObj( blkobj ) {
  let privkeyhex = env.VARS.AGENT_PRIVKEYHEX
  if (!privkeyhex) admin.respondHttp( 500, "config: agent key" )

  let redobj = ecjson.blackToRed( privkeyhex, blkobj )
  if (!redobj) {
    admin.respondHttp( 400, "signature validation/decryption failed" )
  }

  return redobj
}

// Record the request, ACK the HTTP channel, and deliver the JSON-RPC result
// asynchronously to the caller's own CARP interface. This is the shape every
// service in concierge.json declares ("synchronous": false + red-async-result):
// the HTTP response carries no service payload, only an ACK. A caller that
// does not run a CARP interface therefore gets nothing, which is exactly the
// denial-of-token defence CABEZON wants.
async function answerAsync( callerpubkeyhex, redobj, result ) {

  requests.add( callerpubkeyhex, redobj )   // record so nextrequest surfaces it

  let redres = reply.redResult( redobj.id, result )

  // Stage the reply in the polled answers queue FIRST, so a caller that
  // collects via /cgi-bin/nextanswer always gets it -- even if the push to
  // its own CARP interface below fails (e.g. caller has no reachable url).
  // redres already carries the JSON-RPC 2.0 envelope { jsonrpc, result, id },
  // with the request cookie as id, so the caller can correlate the reply.
  try { answers.enqueue( redobj.id, redres ) }
  catch (e) { /* queue only */ }

  let status = await reply.deliver( callerpubkeyhex, redres )

  try { requests.setResult( callerpubkeyhex, redobj.id, result ) }
  catch (e) { /* bookkeeping only */ }

  if (!status.ok) {
    // The answer could not be handed to the caller's interface. Tell them so
    // over the request channel -- still no service payload.
    admin.respondHttp( 502,
      "async result delivery failed: " + (status.reason || status.status) )
  }

  admin.respondHttp( 200, "ACK" )
}

// Heal invalidated SAD caches before serving the directory. A member's
// cached SAD is emptied by waku-poll on a trusted registrar.identity.updated
// event (the registrar record changed; the old cached descriptor may be
// stale). This pulls the current SAD from Nautilus for every member whose
// cache is empty, best-effort and bounded: registrar unreachable or lookup
// failures are logged and skipped (the member stays in the ledger with an
// empty cache; byRole/directory skip empty descriptors, and the next agents()
// call retries). Never throws into the request path.
const nautilusClient = require( './nautilus.js' )
async function refreshInvalidSads() {
  const members = sads.all().filter( rec =>
    !rec.sad || Object.keys( rec.sad ).length === 0 )
  for ( const rec of members ) {
    try {
      const r = await nautilusClient.getRegistered( rec.pubkeyhex )
      if ( r.ok ) {
        sads.updateSad( rec.pubkeyhex, r.sad, r.sourceUrl,
          { nautilusLastupdate: r.lastupdate } )
        process.stderr.write( 'agents: refreshed SAD cache for ' + rec.pubkeyhex.slice( 0, 10 ) + '... from registrar\n' )
      }
      else {
        process.stderr.write( 'agents: SAD refresh for ' + rec.pubkeyhex.slice( 0, 10 ) + '... failed: ' + r.reason + '\n' )
      }
    }
    catch ( e ) {
      process.stderr.write( 'agents: SAD refresh for ' + rec.pubkeyhex.slice( 0, 10 ) + '... error: ' + e.toString() + '\n' )
    }
  }
}

exports.processRequest = async function ( paramobj ) {

  let redobj

  if (paramobj && paramobj.msghex && paramobj.sighex && paramobj.spkhex) {
    screen( paramobj.spkhex )
    redobj = toRedObj( paramobj )
  }
  else {
    admin.respondHttp( 401, "body is missing authentication" )
  }

  if (!SERVICES[redobj.method])
    admin.respondHttp( 400, "method is not a recognized service" )

  // Concierge.join preflight — runs BEFORE the fee gate so a caller who
  // cannot join never has their payment marked serviced (fees.setUsed).
  // An unknown role or a missing registrar identity is a transport-channel
  // refusal: the fee txhash stays unserviced and reusable. Cheap by design
  // (one registrar lookup, no agent tokens), so it does not open a drain.
  let joinRole = null
  let joinReg = null
  if (redobj.method === 'join') {
    joinRole = (redobj.params && redobj.params[0]) || ''
    if (typeof joinRole !== 'string') joinRole = ''
    joinRole = joinRole.trim()
    if (!joinRole) joinRole = 'Customer'

    if (!sads.recognizedRoles.includes(joinRole)) {
      admin.respondHttp( 400, "unknown CABEZON role: " + joinRole )
    }

    // Membership prerequisite: the caller must already be registered with
    // Nautilus (the world registrar) and the registrar's SAD must be bound
    // to the caller's own key. Fail closed: not registered -> no join;
    // registrar unreachable -> no join (retry later). The registrar's SAD
    // must also VERIFY cryptographically (2026-10-25 ingest policy): a
    // corrupt registrar copy must not be onboarded, and since this preflight
    // runs BEFORE the fee gate, the caller's fee txhash is never marked
    // serviced for a join we would refuse.
    const nautilus = require( './nautilus.js' )
    try {
      joinReg = await nautilus.requireRegistered( paramobj.spkhex )
    }
    catch ( e ) {
      admin.respondHttp( 502, "registrar check failed: " + e.toString() )
    }
    if ( !joinReg.ok ) {
      if ( joinReg.unreachable )
        admin.respondHttp( 502, "registrar unreachable, try again later: " + joinReg.reason )
      admin.respondHttp( 400, "join prerequisite: " + joinReg.reason )
    }
    // Ingest gate: the registrar descriptor itself must verify (structure +
    // ES256K recovery + did:key binding against the caller's own key).
    const sadverify = require( './sadverify.js' )
    const joinVerify = sadverify.verify( paramobj.spkhex, joinReg.sad )
    if ( !joinVerify.ok ) {
      admin.respondHttp( 502,
        "join prerequisite: registrar SAD does not verify: " + joinVerify.reason )
    }
  }

  let feeObj = fees.agentFee( redobj.method )

  if (feeObj && feeObj.amt) {

    let cookie = redobj.id
    if (!cookie) admin.respondHttp( 402, feeObj )

    // The cookie IS the payment txhash. Validate its shape BEFORE it
    // reaches the Etherscan URL or the marker filename. Issue #9:
    // traversal + query injection via the request id.
    if ( !fees.isValidTxnHash(cookie) )
      admin.respondHttp( 400, "bad transaction hash: expected 0x + 64 hex" )

    try {
      // Fast, non-binding pre-check for the common replay; the binding
      // decision is the atomic claimUsed at the end of the gate.
      if ( fees.isUsed(cookie) )
        admin.respondHttp( 400, "payment already serviced" )

      let etxn = await fees.getEthereumTxn( cookie )

      if (!etxn || !etxn.from)
        admin.respondHttp( 400, "didnt find that txnhash" )

      if ( !fees.isFrom(etxn, paramobj.spkhex) )
        admin.respondHttp( 400, "payment must be from caller" )

      if ( !fees.isMined(etxn) ) admin.respondHttp( 102, "awaiting mining" )

      // Mined is not paid: a tx that reverted in its block moved no
      // value, and only the receipt says so. Issue #9.
      let receipt = await fees.getEthereumReceipt( cookie )
      if ( !receipt ) admin.respondHttp( 102, "awaiting mining" )
      if ( !fees.isExecuted(receipt) )
        admin.respondHttp( 400, "payment transaction failed on chain (reverted)" )

      let checks = fees.checkSufficient( etxn, feeObj )
      if ( checks != null ) admin.respondHttp( 400, checks )

      // One atomic step replaces the old isUsed-then-setUsed pair:
      // exactly ONE concurrent request with this txhash wins; the
      // rest are refused here. Issue #9 race.
      let claim = fees.claimUsed( cookie )
      if ( !claim.ok )
        admin.respondHttp( 400, claim.reason )
    }
    catch( ex ) {
      admin.respondHttp( 500, ex.toString() )
    }

  } // end if fee required

  // Concierge.agents: return the stored Signed Agent Descriptor(s).
  //   params == []            -> full directory { <role>: [SAD, ...], ... }
  //                               (incl. El-Cabezon's own Concierge SAD).
  //   params == [ "<role>" ]  -> array of SADs for that one role (possibly []).
  // Both are declared in interface/concierge.json.
  //
  // Cache-then-serve under the DID:Role membership model: member SADs are
  // cached at join time and refreshed from Nautilus (the authoritative
  // registrar store) when invalidated by a registrar.identity.updated bus
  // event. Invalidated caches are healed lazily here, best-effort: if the
  // registrar is unreachable the member is simply skipped this round (its
  // record survives; the next call retries the refresh).
  if (redobj.method === 'agents') {
    try {
      await refreshInvalidSads()
    }
    catch ( e ) {
      process.stderr.write( 'agents: SAD cache refresh failed: ' + e.toString() + '\n' )
    }

    let role = redobj.params && redobj.params[0]
    let found

    // El-Cabezon advertises itself under the Concierge role, built from the
    // live SAD endpoint so callers can always reach the mall's rendezvous
    // point. Build it once here so both the empty-param and role-filtered
    // branches can include it.
    let mySAD = null
    try {
      const cgi = require( './el-cabezon' )
      mySAD = cgi.buildSAD()
    }
    catch (e) { mySAD = null }

    // Empty (or blank) parameter list -> full directory of all CABEZON agents.
    if (!role || (typeof role === 'string' && role.trim() === '')) {
      found = sads.directory( mySAD )
    }
    else {
      found = sads.sadsForRole( role )
      // If the caller asked for the Concierge role, prepend El-Cabezon's own
      // SAD — it is not stored on disk (built live) so sadsForRole won't
      // include it. The directory() call injects it for the empty-param case,
      // but the role-filtered path missed it.
      if (role === 'Concierge' && mySAD) {
        found = [ mySAD, ...found ]
      }
    }

    await answerAsync( paramobj.spkhex, redobj, found )
    return
  }

  // Concierge.roles: return the cabezon-role-name enumeration from
  // definitions.json, each {RoleName: descrip} flattened to {role, descrip}.
  // The enumeration was upgraded from a bare list of strings to an array of
  // single-key objects; defs.roleEnumeration() flattens it and reads the file
  // FRESH per call so edits to the role catalog show up with no redeploy (same
  // pattern as concierge.about.txt). Delivered asynchronously like every
  // other service. Declared in concierge.json with "synchronous": false and a
  // red-async-result of [{role, descrip}].
  if (redobj.method === 'roles') {
    let catalog
    try {
      const defs = require( './defs.js' )
      catalog = defs.roleEnumeration()
    }
    catch (e) {
      // definitions.json missing/malformed -- answer with an empty catalog
      // rather than crashing the request channel.
      catalog = []
    }

    await answerAsync( paramobj.spkhex, redobj, catalog )
    return
  }

  // Concierge.about: return the contents of concierge.about.txt, the editable
  // blurb any account can update in place. Read fresh each call so edits show
  // up immediately. Delivered asynchronously like every other service.
  if (redobj.method === 'about') {
    let text = "El-Cabezon is the CABEZON Concierge.\n"
    try {
      if (fs.existsSync(ABOUT_FILE))
        text = fs.readFileSync(ABOUT_FILE, 'utf-8')
    }
    catch (e) {
      // fall through to the default blurb on any read error
    }

    await answerAsync( paramobj.spkhex, redobj, text )
    return
  }

  // Concierge.rent: monthly membership fee. The fee gate above has already
  // verified the Etherscan payment (tx mined AND executed -- receipt status
  // 0x1 -- from caller, >= 0.001 ETH to El-Cabezon's wallet, not replayed).
  // The request cookie IS the fee+rent payment txhash. Deliver a
  // cabezon-rent-receipt asynchronously:
  //   [ <payment-and-fee-transaction-hash>, <account-balance> ]
  if (redobj.method === 'rent') {
    let balance = await fees.getEthereumBalance( env.VARS.AGENT_ETH_ADDRESS )
    let receipt = [ redobj.id, balance ]
    await answerAsync( paramobj.spkhex, redobj, receipt )

    // Publish rent received event to CABEZON message bus (Nwaku).
    waku.publishRentReceived( paramobj.spkhex, redobj.id ).then( r => {
      if (!r.ok) process.stderr.write( 'waku publishRentReceived: ' + r.reason + '\n' )
    } ).catch( e => {
      process.stderr.write( 'waku publishRentReceived error: ' + e.toString() + '\n' )
    } )

    return
  }

  // Concierge.join: join CABEZON as a member (or upgrade from Customer).
  // The fee gate above has already verified the 0.1 ETH payment. The join
  // PREFLIGHT (before the fee gate) already checked: (a) the role is a
  // recognized CABEZON role, and (b) the caller is registered with Nautilus
  // and the registrar SAD is bound to the caller's key (joinRole/joinReg).
  // Returns a rental agreement (structured object) asynchronously.
  if (redobj.method === 'join') {
    const role = joinRole
    const reg = joinReg

    // Register the caller under the chosen role, onboarding the REAL SAD
    // from the registrar (never a minimal placeholder — the registrar record
    // is the authoritative descriptor under the DID:Role membership model).
    // sads.onboard creates a new record or merges the role into an existing
    // one (idempotent on roles).
    sads.onboard( paramobj.spkhex, role, reg.sad, reg.sourceUrl )

    // Publish onboarded event to CABEZON message bus (Nwaku).
    // Fire-and-forget: delivery is best-effort and must not block the
    // synchronous HTTP response path.  Log failures for ops visibility.
    waku.publishOnboarded( role, paramobj.spkhex ).then( r => {
      if (!r.ok) process.stderr.write( 'waku publishOnboarded: ' + r.reason + '\n' )
    } ).catch( e => {
      process.stderr.write( 'waku publishOnboarded error: ' + e.toString() + '\n' )
    } )

    let agreement = {
      status: "joined",
      role: role,
      agent: paramobj.spkhex,
      fee_txhash: redobj.id,
      rent_required: (role !== 'Customer'),
    }
    await answerAsync( paramobj.spkhex, redobj, agreement )
    return
  }

  requests.add( paramobj.spkhex, redobj )

  admin.respondHttp( 200, "ACK" )
}

function processAnswer( blkobj ) {
  try {
    let redobj = toRedObj( blkobj )
    redobj.sender = blkobj.spkhex

    // Re-emit the async reply as a proper JSON-RPC 2.0 envelope and stage it in
    // the polled answers queue. The caller correlates this reply to the request
    // it sent via `id` -- the original request cookie (redobj.id) -- which we
    // preserve verbatim. We deliberately do NOT stamp .id onto the inner
    // result/error payload (that produced bare, un-relatable replies before).
    let reply
    if (redobj.error) {
      reply = { jsonrpc: "2.0", id: redobj.id, error: redobj.error }
    }
    else if (redobj.result !== undefined && redobj.result !== null) {
      reply = { jsonrpc: "2.0", id: redobj.id, result: redobj.result }
    }
    else {
      admin.respondHttp( 400, "message must include result or error" )
      return
    }

    answers.enqueue( redobj.id, reply )
  }
  catch( ex ) {
    admin.respondHttp( 500, ex.toString() )
  }

  admin.respondHttp( 200, "ACK" )
}

// handle receiving a request from another agent

module.exports.dorequest = function() {

  // systems check

  if (    !env.VARS.AGENT_PRIVKEYHEX
       || !env.VARS.AGENT_ETH_ADDRESS
       || !env.VARS.ETHERSCAN_API_KEY )
    admin.respondHttp( 503, "config missing" )

  // all encrequests are POST only

  if (process.env.REQUEST_METHOD !== 'POST') {
    admin.respondHttp( 405, "POST only" )
  }

  process.stdin.on( 'data', data => {
    let body = JSON.parse( data.toString() )
    exports.processRequest( body )
  } )

}

// handle receiving the result of some request we sent to another agent

module.exports.doresult = function() {

  // all encresults are POST 
  if (process.env.REQUEST_METHOD !== 'POST') {
      admin.respondHttp( 405, "POST only" )
  }

  process.stdin.on( 'data', data => {
    let body = JSON.parse( data.toString() )
    processAnswer( body )
  } )

}
