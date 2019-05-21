import BN from 'bn.js';
import elliptic from 'elliptic';
import crypto from 'crypto';
import blake from 'blakejs';

const EC = elliptic.ec;
const rand = crypto.randomBytes;

const { curve } = EC('secp256k1');

const ergoSchnorr = {};

ergoSchnorr.numHash = (s) => {
  const KEY = null;
  const OUTPUT_LENGTH = 32;
  const context = blake.blake2bInit(OUTPUT_LENGTH, KEY);
  blake.blake2bUpdate(context, Buffer.from(s));
  const h = blake.blake2bFinal(context);
  return new BN(h.slice(0, 24));
};

ergoSchnorr.genCommitment = (pk, w) => {
  const prefix = Buffer.from('010027100108cd', 'hex');
  const postfix = Buffer.from('73000021', 'hex');
  return Buffer.concat([prefix, pk, postfix, w]);
};

ergoSchnorr.tryToSign = (msgBytes, sk) => {
  const y = new BN(rand(32)).umod(curve.n);

  // crucial: y has to remain secret and be removed ASAP
  // it also should come from a good entropy source
  if (y.isZero()) {
    return null;
  }

  const w = Buffer.from(curve.g.mul(y).encodeCompressed());
  const pk = Buffer.from(curve.g.mul(sk).encodeCompressed());
  const commitment = ergoSchnorr.genCommitment(pk, w);
  const s = Buffer.concat([commitment, msgBytes]);
  const c = ergoSchnorr.numHash(s);
  if (c.isZero()) {
    return null;
  }
  const z = sk.mul(c).add(y).umod(curve.n);
  const cb = Buffer.from(c.toArray('big', 24));
  const zb = Buffer.from(z.toArray('big', 32));

  return Buffer.concat([cb, zb]);
};

export const sign = (msgBytes, sk) => {
  let sig = ergoSchnorr.tryToSign(msgBytes, sk);

  while (!sig) {
    sig = ergoSchnorr.tryToSign(msgBytes, sk);
  }
  return sig;
};

export const verify = (msgBytes, sigBytes, pkBytes) => {
  if (sigBytes.length !== 56) {
    throw new Error();
  }
  const c = new BN(sigBytes.slice(0, 24));
  const z = new BN(sigBytes.slice(24, 56));
  const pk = curve.decodePoint(pkBytes);
  const t = pk.mul(curve.n.sub(c));
  const w = curve.g.mul(z).add(t);
  const wb = Buffer.from(w.encodeCompressed());
  const commitment = ergoSchnorr.genCommitment(Buffer.from(pkBytes), wb);

  const s = Buffer.concat([commitment, msgBytes]);
  const c2 = ergoSchnorr.numHash(s);

  return c2.eq(c);
};
