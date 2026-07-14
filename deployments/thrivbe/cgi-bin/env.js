// Thrivbe deployment adapter. Runtime secrets are supplied by Docker env_file.
exports.VARS = {
  AGENT_PRIVKEYHEX: process.env.CARP_PRIVKEY_HEX || ''
}
