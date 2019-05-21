import BN from 'bn.js';
import blake from 'blakejs';
import bs58 from 'bs58';
import elliptic from 'elliptic';
import url from 'url';
import constants from './constants';
import { sign } from './ergo_schnorr';

const EC = elliptic.ec;
const { curve } = EC('secp256k1');

export async function getCurrentHeight() {
  const { total } = await fetch(
    url.resolve(constants.testnet_url, '/blocks?limit=1'),
    {
      headers: {
        Accept: 'application/json',
      },
      method: 'GET',
    }
  ).then(res => res.json());

  return total;
}

/**
 * Get public key from wallet
 *
 * @param  {number} ergoAdress
 */

export function pkFromWallet(ergoAdress) {
  const adrBytes = bs58.decode(ergoAdress);
  return adrBytes.slice(1, 34);
}

/**
 * Get wallet from public key
 *
 * @param  {string} pk
 * @param  {boolean} testNet
 */

export function walletFromPK(pk, testNet = false) {
  let NETWORK_TYPE;
  const P2PK_TYPE = 1;

  if (testNet) NETWORK_TYPE = 16;
  else NETWORK_TYPE = 0;

  const prefixByte = Buffer.from([NETWORK_TYPE + P2PK_TYPE]);
  const contentBytes = Buffer.from(pk, 'hex');
  const checksum = Buffer.from(blake.blake2b(Buffer.concat([prefixByte, contentBytes]), null, 32), 'hex');
  const address = Buffer.concat([prefixByte, contentBytes, checksum]).slice(0, 38);

  return bs58.encode(address);
}

/**
 * Get wallet from secret key
 *
 * @param  {string} sk
 * @param  {boolean} testNet
 */

export function walletFromSK(sk, testNet = false) {
  const pk = Buffer.from(curve.g.mul(sk).encodeCompressed());
  return walletFromPK(pk, testNet);
}

function intToVlq(num) {
  let x = num;
  let res = Buffer.from([]);
  let r;
  while (parseInt(x / (2 ** 7))) {
    r = x & 0x7F;
    x = parseInt(x / (2 ** 7));
    res = Buffer.concat([res, Buffer.from([(r | 0x80)], null, 1)]);
  }
  r = (x & 0x7F);
  res = Buffer.concat([res, Buffer.from([r], null, 1)]);
  return res;
}

function outputBytes(out) {
  let res = intToVlq(out.value);
  res = Buffer.concat([res, Buffer.from(out.ergoTree, 'hex')]);
  res = Buffer.concat([res, intToVlq(out.creationHeight)]);

  res = Buffer.concat([res, intToVlq(out.assets.length)]);
  const k = out.additionalRegisters.length;
  res = Buffer.concat([res, intToVlq(k)]);
  return res;
}

function valueSerialize(val) {
  return '';
}

function inputBytes(i) {
  let res = Buffer.from(i.boxId, 'hex');
  const sp = i.spendingProof;
  res = Buffer.concat([res, intToVlq(sp.proofBytes.length)]);
  res = Buffer.concat([res, Buffer.from(sp.proofBytes, 'hex')]);
  res = Buffer.concat([res, intToVlq(sp.extension.length)]);
  for (const k in sp.extension) {
    res += intToVlq(k);
    res += valueSerialize(sp.extension[k]);
  }
  return res;
}

function distinctTokenList(outputs) {
  // TODO: rework this
  return [];
}

function serializeTx(tx) {
  let res = intToVlq(tx.inputs.length);
  for (const key in tx.inputs) {
    res = Buffer.concat([res, inputBytes(tx.inputs[key])]);
  }
  res = Buffer.concat([res, intToVlq(tx.dataInputs.length)]);

  for (const i in tx.dataInputs) {
    res = Buffer.concat([res, Buffer.from(i.boxId, 'hex')]);
  }

  const distinctIds = distinctTokenList(tx.outputs);

  res = Buffer.concat([res, intToVlq(distinctIds.length)]);

  for (const d in distinctIds) {
    res = Buffer.concat([res, Buffer.from(distinctIds[d], 'hex')]);
  }

  res = Buffer.concat([res, intToVlq(tx.outputs.length)]);
  for (const key in tx.outputs) {
    res = Buffer.concat([res, outputBytes(tx.outputs[key])]);
  }
  return res;
}

/**
 * @param  {String} recipient
 * @param  {Number} amount
 * @param  {Number} fee
 * @param  {Array[object]} boxesToSpend
 * @param  {String} chargeAddress
 * @param  {Number} height
 */

export function formTransaction(recipient, amount, fee, boxesToSpend, chargeAddress, height) {
  const globalAmount = boxesToSpend.reduce((sum, box) => sum + box.amount, 0);
  const outputs = [
    {
      address: recipient,
      amount,
    },
    {
      address: chargeAddress,
      amount: globalAmount - amount - fee,
    },
  ];

  return createTransaction(boxesToSpend, outputs, fee, height);
}

/**
 * @param  {Array[object]} boxesToSpend
 * @param  {Array} outputs
 * @param  {Number} fee
 * @param  {Number} height
 */

export function createTransaction(boxesToSpend, outputs, fee, height) {
  const unsignedTransaction = {
    inputs: [],
    dataInputs: [],
    outputs: [],
  };

  const ergoTreeBytes = Buffer.from([0x00, 0x08, 0xcd]);
  const minerErgoTree = constants.minerTree;

  for (const i in outputs) {
    const { address, amount } = outputs[i];
    const tree = Buffer.concat([ergoTreeBytes, pkFromWallet(address)]).toString('hex');

    unsignedTransaction.outputs.push({
      ergoTree: tree,
      assets: [],
      additionalRegisters: {},
      value: amount,
      creationHeight: height,
    });
  }

  if (fee !== null && fee !== undefined) {
    unsignedTransaction.outputs.push({
      ergoTree: minerErgoTree,
      assets: [],
      additionalRegisters: {},
      value: fee,
      creationHeight: height,
    });
  }

  boxesToSpend.forEach((box) => {
    unsignedTransaction.inputs.push({
      boxId: box.id,
      spendingProof: {
        proofBytes: '',
        extension: {},
      },
    });
  });

  const signedTransaction = { ...unsignedTransaction };
  const serializeTransaction = serializeTx(unsignedTransaction);

  signedTransaction.inputs.forEach((input, ind) => {
    const signBytes = sign(serializeTransaction, new BN(boxesToSpend[ind].sk, 16));
    input.spendingProof.proofBytes = signBytes.toString('hex');
  });

  return signedTransaction;
}

/**
 * @param  {string} recipient
 * @param  {number} amount
 * @param  {number} fee
 * @param  {string} sk
 */

export async function sendWithoutBoxId(recipient, amount, fee, sk) {
  const wallet = walletFromSK(sk, true);
  const height = await getCurrentHeight();

  fetch(constants.unspent_url + wallet,
    {
      headers: {
        Accept: 'application/json',
      },
      method: 'GET',
    })
    .then(res => res.json())
    .then((data) => {
      const resBox = data.filter(x => x.value >= Number(amount) + Number(fee));

      const boxesSort = (boxes) => {
        const sortableKeys = Object.keys(boxes).sort((a, b) => boxes[b].value - boxes[a].value);

        return sortableKeys;
      };

      if (resBox.length === 0) {
        let initValue = 0;
        const initBoxes = [];
        for (const key of boxesSort(data)) {
          initValue += data[key].value;
          initBoxes.push(data[key]);

          if (initValue >= Number(amount) + Number(fee)) {
            const b = initBoxes.map(box => ({ id: box.id, amount: box.value, sk }));
            sendTransaction(recipient, amount, fee, b, wallet, height);
            break;
          }
        }

        if (initValue < Number(amount) + Number(fee)) {
          throw new Error('Insufficient funds');
        }
      } else {
        const b = {
          id: resBox[0].id,
          amount: resBox[0].value,
          sk,
        };

        sendTransaction(recipient, amount, fee, [b], wallet, height);
      }
    })
    .catch((res) => {
      console.log(res);
    });
}

/**
 * Send transaction to address
 *
 * @param  {String} recipient
 * @param  {Number} amount
 * @param  {Number} fee
 * @param  {Array[object]} boxesToSpend
 * @param  {String} chargeAddress
 * @param  {Number} height
 */

export function sendTransaction(recipient, amount, fee, boxesToSpend, chargeAddress, height) {
  const signedTransaction = formTransaction(
    recipient, amount, fee, boxesToSpend, chargeAddress, height
  );

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
  .then((res) => {
    console.log(res);
  })
  .catch((res) => {
    console.log(res);
  });
}
