import { walletFromPK } from './index'
import { sign, verify } from './ergo_schnorr'
import BN from 'bn.js'

test('P2PK wallet in test network test vector', () => {
  expect(walletFromPK('0326df75ea615c18acc6bb4b517ac82795872f388d5d180aac90eaa84de750b942', true)).toBe('3Wxr5EGDUig8cKof1KwySX7KDMLc6mxFmJ9toKZ7oNQV6BUzCs1H');
});

test('simple signature test vector', () => {
  const msg_bytes = Buffer.from("1dc01772ee0171f5f614c673e3c7fa1107a8cf727bdf5a6dadb379e93c0d1d00", 'hex')
  const pk_bytes = Buffer.from("0326df75ea615c18acc6bb4b517ac82795872f388d5d180aac90eaa84de750b942", 'hex')
  const sk = Buffer.from("f4aa4c487af71fb8b52a3ecd0d398393c2d247d6f0a25275e5d986854b3e2db8", 'hex')
  const sign_bytes = sign(msg_bytes, new BN(sk))

  expect(verify(msg_bytes, sign_bytes, pk_bytes)).toBe(true);
});