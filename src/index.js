import { sign } from './ergo_schnorr'
import BN from 'bn.js'

export function sendTransaction(msg, sk) {
  var msg_bytes = Buffer.from(JSON.stringify(msg), 'utf8');
  var skBig = new BN(sk)
  return sign(msg_bytes, skBig).toString('hex')
}