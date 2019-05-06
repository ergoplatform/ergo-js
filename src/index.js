import BN from 'bn.js';
import blake from 'blakejs';
import bs58 from 'bs58';
import elliptic from 'elliptic';
import constants from './constants';
import { sign } from './ergo_schnorr';

const EC = elliptic.ec;
const { curve } = EC('secp256k1');

export function pkFromWallet(ergoAdress) {
  const adr_bytes = bs58.decode(ergoAdress);
  return adr_bytes.slice(1, 34);
}

export function walletFromPK(pk, test_net = false) {
  // pk - string
  // test_net - boolean

  let NETWORK_TYPE;
  const P2PK_TYPE = 1;

  if (test_net) NETWORK_TYPE = 16;
  else NETWORK_TYPE = 0;

  const prefix_byte = new Buffer.from([NETWORK_TYPE + P2PK_TYPE]);
  const content_bytes = new Buffer.from(pk, 'hex');
  const checksum = Buffer.from(blake.blake2b(Buffer.concat([prefix_byte, content_bytes]), null, 32), 'hex');
  const address = Buffer.concat([prefix_byte, content_bytes, checksum]).slice(0, 38);

  return bs58.encode(address);
}

function walletFromSK(sk, test_net = false) {
  const pk = Buffer.from(curve.g.mul(sk).encodeCompressed());
  return walletFromPK(pk, test_net);
}

function int_to_vlq(param) {
  let x = param;
  let res = new Buffer([]);
  let r;
  while (parseInt(x / 2 ** 7)) {
    r = x & 0x7F;
    x = parseInt(x / 2 ** 7);
    res = Buffer.concat([res, Buffer.from([(r | 0x80)], null, 1)]);
  }
  r = (x & 0x7F);
  res = Buffer.concat([res, Buffer.from([r], null, 1)]);
  return res;
}

function output_bytes(out) {
  let res = int_to_vlq(out.value);
  res = Buffer.concat([res, Buffer.from(out.ergoTree, 'hex')]);
  res = Buffer.concat([res, int_to_vlq(out.creationHeight)]);

  res = Buffer.concat([res, int_to_vlq(out.assets.length)]);
  const k = out.additionalRegisters.length;
  res = Buffer.concat([res, int_to_vlq(k)]);
  return res;
}

function value_serialize(val) {
  return '';
}

function input_bytes(i) {
  let res = Buffer.from(i.boxId, 'hex');
  const sp = i.spendingProof;
  res = Buffer.concat([res, int_to_vlq(sp.proofBytes.length)]);
  res = Buffer.concat([res, Buffer.from(sp.proofBytes, 'hex')]);
  res = Buffer.concat([res, int_to_vlq(sp.extension.length)]);
  for (const k in sp.extension) {
    res += int_to_vlq(k);
    res += value_serialize(sp.extension[k]);
  }
  return res;
}

function distinct_token_list(outputs) {
  // TODO: rework this
  return [];
}

function serialize_tx(tx) {
  let res = int_to_vlq(tx.inputs.length);
  for (var key in tx.inputs) {
    res = Buffer.concat([res, input_bytes(tx.inputs[key])]);
  }
  res = Buffer.concat([res, int_to_vlq(tx.dataInputs.length)]);

  for (const i in tx.dataInputs) {
    res = Buffer.concat([res, Buffer.from(i.boxId, 'hex')]);
  }

  const distinct_ids = distinct_token_list(tx.outputs);

  res = Buffer.concat([res, int_to_vlq(distinct_ids.length)]);
  for (const d in distinct_ids) {
    res = Buffer.concat([res, Buffer.from(distinct_ids[d], 'hex')]);
  }
  res = Buffer.concat([res, int_to_vlq(tx.outputs.length)]);
  for (var key in tx.outputs) {
    res = Buffer.concat([res, output_bytes(tx.outputs[key])]);
  }
  return res;
}

export function formTransaction(recipient, amount, fee, boxesToSpend, chargeAddress, height) {
  const unsignedTransaction = {
    inputs: [
    ],
    dataInputs: [
    ],
    outputs: [
    ],
  };

  const ergoTree_bytes = new Buffer([0x00, 0x08, 0xcd]);

  const recipient_ergoTree_bytes = Buffer.concat([ergoTree_bytes, pkFromWallet(recipient)]);
  const recipient_ergoTree = recipient_ergoTree_bytes.toString('hex');

  const chargeAddress_ergoTree_bytes = Buffer.concat([ergoTree_bytes, pkFromWallet(chargeAddress)]);
  const chargeAddress_ergoTree = chargeAddress_ergoTree_bytes.toString('hex');

  const miner_ergoTree = constants.minerTree;
  const globalAmount = boxesToSpend.reduce((sum, box) => sum + box.amount, 0);

  unsignedTransaction.outputs.push({
    ergoTree: recipient_ergoTree,
    assets: [],
    additionalRegisters: {},
    value: amount,
    creationHeight: height,
  });
  unsignedTransaction.outputs.push({
    ergoTree: chargeAddress_ergoTree,
    assets: [],
    additionalRegisters: {},
    value: globalAmount - amount - fee,
    creationHeight: height,
  });
  unsignedTransaction.outputs.push({
    ergoTree: miner_ergoTree,
    assets: [],
    additionalRegisters: {},
    value: fee,
    creationHeight: height,
  });

  boxesToSpend.forEach((box) => {
    unsignedTransaction.inputs.push({
      boxId: box.id,
      spendingProof: {
        proofBytes: '',
        extension: {},
      },
    });
  });

  const signedTransaction = Object.assign({}, unsignedTransaction);
  signedTransaction.inputs.forEach((input, ind) => {
    const sign_bytes = sign(serialize_tx(unsignedTransaction), new BN(boxesToSpend[ind].sk, 16));
    input.spendingProof.proofBytes = sign_bytes.toString('hex');
  });
  return signedTransaction;
}

export function sendWithoutBoxId(recipient, amount, fee, sk) {
  const wallet = walletFromSK(sk, true);

  fetch(constants.unspent_url + wallet,
    {
      headers: {
        Accept: 'application/json',
      },
      method: 'GET',
    })
    .then(res => res.json())
    .then((json) => {
      for (const [index, box] of json.entries()) {
        if (box.value >= amount + fee) {
          const b = {
            id: box.id,
            amount: box.value,
            sk,
          };
          sendTransaction(recipient, amount, fee, [b], wallet, 1);
          break;
        }
      }
    })
    .catch((res) => { console.log(res); });
}

export function sendTransaction(recipient, amount, fee, boxesToSpend, chargeAddress, height) {
  // recipient - String
  // amount - Number
  // fee - Number
  // boxesToSpend - { id, amount, sk }

  const signedTransaction = formTransaction(recipient, amount, fee, boxesToSpend, chargeAddress, height);

  const sendTransactionURL = constants.url;

  fetch(sendTransactionURL,
    {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      method: 'POST',
      body: JSON.stringify(signedTransaction),
    })
    .then((res) => { console.log(res); })
    .catch((res) => { console.log(res); });
}
