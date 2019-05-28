import BN from 'bn.js';
import blake from 'blakejs';
import bs58 from 'bs58';
import { ec } from 'elliptic';
import url from 'url';
import is from 'is_js';
import constants from './constants';
import { serializeTx, sortBoxes } from './supportFunctions';
import { sign } from './ergo_schnorr';
import { testNetServer, transactionsServer } from './api';

const { curve } = ec('secp256k1');

export const getCurrentHeight = async () => {
  const { data: { total } } = await testNetServer({
    url: '/blocks?limit=1',
    method: 'GET',
  });

  return total;
};

/**
 * @param  {string} address
 */

export const getBoxesFromAddress = async (address) => {
  if (is.not.string(address)) {
    throw new TypeError('Bad type in params');
  }

  const { data } = await testNetServer({
    url: `/transactions/boxes/byAddress/unspent/${address}`,
    method: 'GET',
  });

  return data;
};

/**
 * @param  {Array[object({ id: number, amount: number })]} boxes
 * @param  {Number} amount
 * @param  {Number} fee
 */

export const getResolveBoxes = (boxes, amount, fee) => {
  if (
    is.not.array(boxes)
    || is.not.number(amount)
    || is.not.number(fee)
  ) {
    throw new TypeError('Bad type in params');
  }

  let resultValue = 0;
  let resultBoxes = [];
  let hasBoxes = false;
  for (const key of sortBoxes(boxes)) {
    resultValue += boxes[key].value;
    resultBoxes = [...resultBoxes, boxes[key]];

    if (resultValue >= Number(amount) + Number(fee)) {
      hasBoxes = true;
      break;
    }
  }

  if (!hasBoxes) {
    throw new Error('Insufficient funds');
  }

  return resultBoxes.map(box => ({ id: box.id, amount: box.value }));
};

/**
 * @param  {Array[[object({ id: number, amount: number })]]} boxes
 * @param  {String} sk
 */

export const importSkIntoBoxes = (boxes, sk) => {
  try {
    if (
      is.not.array(boxes)
      || is.not.string(sk)
    ) {
      throw new TypeError('Bad type in params');
    }

    return boxes.map(box => ({ ...box, sk }));
  } catch (e) {
    console.log(`${e.name}: ${e.message}`);
  }
};

/**
 * Get public key from address
 *
 * @param  {string} ergoAdress
 */

export const pkFromAddress = (ergoAdress) => {
  try {
    if (
      is.not.string(ergoAdress)
    ) {
      throw new TypeError('Bad type in params');
    }

    const addrBytes = bs58.decode(ergoAdress);
    return addrBytes.slice(1, 34);
  } catch (e) {
    console.log(`${e.name}: ${e.message}`);
  }
};

export const addressFromPK = (pk, testNet = false) => {
  let NETWORK_TYPE;
  const P2PK_TYPE = 1;

  if (testNet) NETWORK_TYPE = 16;
  else NETWORK_TYPE = 0;

  const prefixByte = Buffer.from([NETWORK_TYPE + P2PK_TYPE]);
  const contentBytes = Buffer.from(pk, 'hex');
  const checksum = Buffer.from(blake.blake2b(Buffer.concat([prefixByte, contentBytes]), null, 32), 'hex');
  const address = Buffer.concat([prefixByte, contentBytes, checksum]).slice(0, 38);

  return bs58.encode(address);
};

/**
 * Get address from secret key
 *
 * @param  {string} sk
 * @param  {boolean} testNet
 */

export const addressFromSK = (sk, testNet = false) => {
  try {
    if (
      is.not.string(sk)
      || is.not.boolean(testNet)
    ) {
      throw new TypeError('Bad type in params');
    }

    const pk = Buffer.from(curve.g.mul(sk).encodeCompressed());
    return addressFromPK(pk, testNet);
  } catch (e) {
    console.log(`${e.name}: ${e.message}`);
  }
};

/**
 * @param  {String} recipient
 * @param  {Number} amount
 * @param  {Number} fee
 * @param  {Array[object({ id: number, amount: number, sk(hex): string })]} boxesToSpend
 * @param  {String} chargeAddress
 * @param  {Number} height
 */

export const formTransaction = (recipient, amount, fee, boxesToSpend, chargeAddress, height) => {
  if (
    is.not.string(recipient)
    || is.not.number(amount)
    || is.not.number(fee)
    || is.not.array(boxesToSpend)
    || is.not.string(chargeAddress)
    || is.not.number(height)
  ) {
    throw new TypeError('Bad type in params');
  }

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
};

/**
 * @param  {Array[object({ id: number, amount: number, sk(hex): string })]} boxesToSpend
 * @param  {Array} outputs
 * @param  {Number} fee
 * @param  {Number} height
 */

export const createTransaction = (boxesToSpend, outputs, fee, height) => {
    if (
      is.not.array(boxesToSpend)
      || is.not.array(outputs)
      || is.not.number(fee)
      || is.not.number(height)
    ) {
      throw new TypeError('Bad type in params');
    }

    const unsignedTransaction = {
      inputs: [],
      dataInputs: [],
      outputs: [],
    };

    const ergoTreeBytes = Buffer.from([0x00, 0x08, 0xcd]);
    const minerErgoTree = constants.minerTree;

    for (const i in outputs) {
      const { address, amount } = outputs[i];
      const tree = Buffer.concat([ergoTreeBytes, pkFromAddress(address)]).toString('hex');

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
};

/**
 * @param  {string} recipient
 * @param  {number} amount
 * @param  {number} fee
 * @param  {string} sk
 */

export const sendWithoutBoxId = async (recipient, amount, fee, sk) => {
  if (
    is.not.string(recipient)
    || is.not.number(amount
    || is.not.number(fee)
    || is.not.string(sk))
  ) {
    throw new TypeError('Bad type in params');
  }

  const address = addressFromSK(sk, true);
  const height = await getCurrentHeight();

  const addressBoxes = await getBoxesFromAddress(address);
  const resolveBoxes = getResolveBoxes(addressBoxes, amount, fee, sk);
  const boxesWithSk = importSkIntoBoxes(resolveBoxes, sk);

  sendTransaction(recipient, amount, fee, boxesWithSk, address, height);
};

/**
 * Send transaction to address
 *
 * @param  {String} recipient
 * @param  {Number} amount
 * @param  {Number} fee
 * @param  {Array[object({ id: number, amount: number, sk(hex): string })]} boxesToSpend
 * @param  {String} chargeAddress
 * @param  {Number} height
 */

export const sendTransaction = (recipient, amount, fee, boxesToSpend, chargeAddress, height) => {
  if (
    is.not.string(recipient)
    || is.not.number(amount)
    || is.not.number(fee)
    || is.not.array(boxesToSpend)
    || is.not.string(chargeAddress)
    || is.not.number(height)
  ) {
    throw new TypeError('Bad type in params');
  }

  const signedTransaction = formTransaction(
    recipient, amount, fee, boxesToSpend, chargeAddress, height
  );

  transactionsServer({
    method: 'POST',
    url: `/transactions/send`,
    data: signedTransaction,
  }).then(res => console.log(res));
};
