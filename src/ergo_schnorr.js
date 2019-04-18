import BN from 'bn.js'
import elliptic from 'elliptic'
const EC = elliptic.ec
import crypto from 'crypto'
const rand = crypto.randomBytes
import blake from 'blakejs'
const curve = EC('secp256k1').curve;

let ergo_schnorr = {}

ergo_schnorr.num_hash = function num_hash(s){
    const KEY = null
    const OUTPUT_LENGTH = 32
    let context = blake.blake2bInit(OUTPUT_LENGTH, KEY)
    blake.blake2bUpdate(context, new Buffer.from(s))
    let h = blake.blake2bFinal(context)
    return new BN(h.slice(0,24));
};

ergo_schnorr.gen_commitment = function gen_commitment(pk, w){
    var prefix = Buffer.from('010027100108cd', 'hex');
    var postfix = Buffer.from('73000021', 'hex');
    return new Buffer.concat([prefix, pk, postfix, w])
};

ergo_schnorr.try_to_sign = function try_to_sign(msg_bytes, sk){
    let y = new BN(rand(32)).umod(curve.n);
    
    // crucial: y has to remain secret and be removed ASAP
    // it also should come from a good entropy source
    if(y.isZero())
        throw new Error;

    let w = Buffer.from(curve.g.mul(y).encodeCompressed());
    let pk = Buffer.from(curve.g.mul(sk).encodeCompressed());
    let commitment = ergo_schnorr.gen_commitment(pk, w);
    let s = Buffer.concat([commitment, msg_bytes]);
    let c = ergo_schnorr.num_hash(s);
    if(c.isZero())
        throw new Error;

    let z = sk.mul(c).add(y).umod(curve.n);
    let cb = Buffer.from(c.toArray('big', 24));
    let zb = Buffer.from(z.toArray('big', 32));

    return Buffer.concat([cb, zb]);
};

export function sign(msg_bytes, sk){
    do
        var sig = ergo_schnorr.try_to_sign(msg_bytes, sk);
    while(!sig)
    return sig;
}

export function verify(msg_bytes, sig_bytes, pk_bytes){
    if(sig_bytes.length != 56)
        throw new Error;
    let c = new BN(sig_bytes.slice(0,24));
    let z = new BN(sig_bytes.slice(24,56));
    let pk = curve.decodePoint(pk_bytes); 
    let t = pk.mul(curve.n.sub(c));
    let w = curve.g.mul(z).add(t);
    let wb = Buffer.from(w.encodeCompressed());
    let commitment = ergo_schnorr.gen_commitment(Buffer.from(pk_bytes), wb);

    let s = Buffer.concat([commitment, msg_bytes]);
    let c2 = ergo_schnorr.num_hash(s)

    return c2.eq(c);
}
