import BN from 'bn.js';
import elliptic from 'elliptic';
import crypto from 'crypto';
import blake from 'blakejs';

const EC = elliptic.ec;
const rand = crypto.randomBytes;

const { curve } = EC('secp256k1');

const ergo_schnorr = {};

ergo_schnorr.num_hash = function num_hash(s) {
  const KEY = null;
  const OUTPUT_LENGTH = 32;
  const context = blake.blake2bInit(OUTPUT_LENGTH, KEY);
  blake.blake2bUpdate(context, new Buffer.from(s));
  const h = blake.blake2bFinal(context);
  return new BN(h.slice(0, 24));
};

ergo_schnorr.gen_commitment = function gen_commitment(pk, w) {
  const prefix = Buffer.from('010027100108cd', 'hex');
  const postfix = Buffer.from('73000021', 'hex');
  return new Buffer.concat([prefix, pk, postfix, w]);
};

ergo_schnorr.try_to_sign = function try_to_sign(msg_bytes, sk) {
  const y = new BN(rand(32)).umod(curve.n);

  // crucial: y has to remain secret and be removed ASAP
  // it also should come from a good entropy source
  if (y.isZero()) { return null; }

  const w = Buffer.from(curve.g.mul(y).encodeCompressed());
  const pk = Buffer.from(curve.g.mul(sk).encodeCompressed());
  const commitment = ergo_schnorr.gen_commitment(pk, w);
  const s = Buffer.concat([commitment, msg_bytes]);
  const c = ergo_schnorr.num_hash(s);
  if (c.isZero()) { return null; }
  const z = sk.mul(c).add(y).umod(curve.n);
  const cb = Buffer.from(c.toArray('big', 24));
  const zb = Buffer.from(z.toArray('big', 32));

  return Buffer.concat([cb, zb]);
};

export function sign(msg_bytes, sk) {
  let sig = ergo_schnorr.try_to_sign(msg_bytes, sk);

  do { sig = ergo_schnorr.try_to_sign(msg_bytes, sk); }
  while (!sig);
  return sig;
}

export function verify(msg_bytes, sig_bytes, pk_bytes) {
  if (sig_bytes.length !== 56) { throw new Error(); }
  const c = new BN(sig_bytes.slice(0, 24));
  const z = new BN(sig_bytes.slice(24, 56));
  const pk = curve.decodePoint(pk_bytes);
  const t = pk.mul(curve.n.sub(c));
  const w = curve.g.mul(z).add(t);
  const wb = Buffer.from(w.encodeCompressed());
  const commitment = ergo_schnorr.gen_commitment(Buffer.from(pk_bytes), wb);

  const s = Buffer.concat([commitment, msg_bytes]);
  const c2 = ergo_schnorr.num_hash(s);

  return c2.eq(c);
}
