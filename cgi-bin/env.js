exports.VARS = {
  ETHERSCAN_API_KEY: "",

  // agent identity
  // NOTE: repo template intentionally leaves these empty until deployment-time
  // config is supplied. Before starting the CGI, set AGENT_PRIVKEYHEX to the
  // private key for this agent; otherwise encrypted request processing will
  // fail with "500 config: agent key".
  AGENT_ETH_ADDRESS: "",
  AGENT_PRIVKEYHEX: "",
  AGENT_PUBKEY: "",

  // note: ESCROBOT_SCA is public, smart contract is free for anyone to use
  ESCROBOT_SCA: "0xe9a7520fFc67b808bec949496eB97e96bf3e0C70"
}
