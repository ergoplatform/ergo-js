import { sign } from './ergo_schnorr'
import BN from 'bn.js'
import blake from 'blakejs'
import bs58 from 'bs58'


export function walletFromPK(pk, test_net = false) {
  // pk - string
  // test_net - boolean
  let NETWORK_TYPE
  const P2PK_TYPE = 1

  if(test_net) NETWORK_TYPE = 16
  else NETWORK_TYPE = 0

  const prefix_byte = new Buffer([NETWORK_TYPE + P2PK_TYPE])
  const content_bytes = new Buffer.from(pk, 'hex')
  const checksum = Buffer.from( blake.blake2b(Buffer.concat([prefix_byte, content_bytes]), null, 32), 'hex')
  const address = Buffer.concat([prefix_byte,content_bytes,checksum]).slice(0, 38)

  return bs58.encode(address)
}

export function sendTransaction(msg, sk) {
  //msg - object
  //sk - string

  const msg_bytes = Buffer.from(JSON.stringify(msg), 'utf8');
  const skBig = new BN(Buffer.from(sk, 'hex').join(''));
  const sign_bytes = sign(msg_bytes, skBig);

  return sign_bytes.toString('hex')
}

