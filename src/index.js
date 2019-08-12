import BN from 'bn.js';
import blake from 'blakejs';
import bs58 from 'bs58';
import { ec } from 'elliptic';
import {
  uniq, flatMap, map, reduce, isEmpty,
} from 'lodash/fp';
import is from 'is_js';
import constants from './constants';
import { serializeTx, sortBoxes, getTenBoxesOrCurrent } from './utils';
import { sign } from './ergoSchnorr';
import { testNetServer, mainNetServer } from './api';

const { curve } = ec('secp256k1');

/**
 * A method that selects all the assets in the boxes
 * and returns array with tokenId and amount.
 *
 * @param  {Array} boxes
 * @return {Array[{ tokenId: String, amount: Number }]}
 */

export const getAssetsFromBoxes = (boxes) => {
  if (is.not.array(boxes)) {
    throw new TypeError('Bad params');
  }

  if (isEmpty(boxes)) {
    return [];
  }

  const allAssets = boxes
    |> flatMap(box => box.assets);

  const allTokensIds = allAssets
    |> map(asset => asset.tokenId)
    |> uniq;

  const initialValue = allTokensIds
    |> reduce((acc, asset) => ({ ...acc, [asset]: { tokenId: asset, amount: 0 } }), {});

  const assets = allAssets
    |> reduce((acc, { tokenId, amount }) => ({
      ...acc,
      [tokenId]: { tokenId, amount: acc[tokenId].amount + amount },
    }), initialValue)
    |> Object.values;

  return assets;
};

export const getCurrentHeight = async (testNet = false) => {
  const server = testNet ? testNetServer : mainNetServer;

  const { data: { items } } = await server({
    url: '/blocks?limit=1',
    method: 'GET',
  });

  const lastBlockHeight = items[0].height;

  return lastBlockHeight;
};

/**
 * @param  {string} address
 */

export const getBoxesFromAddress = async (address, testNet = false) => {
  if (is.not.string(address)) {
    throw new TypeError('Bad params');
  }

  const server = testNet ? testNetServer : mainNetServer;
  const { data } = await server({
    url: `/transactions/boxes/byAddress/unspent/${address}`,
    method: 'GET',
  });

  return data;
};

/**
 * @param  {Array} boxes
 * @param  {Number} amount
 * @param  {Number} fee
 */

export const getSolvingBoxes = (boxes, amount, fee) => {
  if (
    is.not.array(boxes)
    || is.empty(boxes)
    || is.not.number(amount)
    || is.not.number(fee)
  ) {
    throw new TypeError('Bad params');
  }

  let boxesCollValue = 0;
  const boxesColl = [];
  let hasBoxes = false;
  const sortedBoxes = sortBoxes(boxes);

  for (const box of sortedBoxes) {
    boxesCollValue += box.value;
    boxesColl.push(box);

    if (boxesCollValue >= amount + fee) {
      hasBoxes = true;
      break;
    }
  }

  if (!hasBoxes) {
    return null;
  }

  const resultBoxes = getTenBoxesOrCurrent(boxesColl, sortedBoxes);

  return resultBoxes;
};

/**
 * @param  {Array} boxes
 * @param  {String} sk
 */

export const importSkIntoBoxes = (boxes, sk) => {
  if (
    is.empty(boxes)
    || is.not.array(boxes)
    || is.not.string(sk)
  ) {
    throw new TypeError('Bad params');
  }

  return boxes.map(box => ({ ...box, sk }));
};

/**
 * @param  {string} ergoAdress
 */

export const pkFromAddress = (ergoAdress) => {
  if (
    is.not.string(ergoAdress)
  ) {
    throw new TypeError('Bad params');
  }

  const addrBytes = bs58.decode(ergoAdress);
  return addrBytes.slice(1, 34);
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
 * @param  {string} sk
 * @param  {boolean} testNet
 */

export const addressFromSK = (sk, testNet = false) => {
  if (
    is.not.string(sk)
    || is.not.boolean(testNet)
  ) {
    throw new TypeError('Bad params');
  }

  const pk = Buffer.from(curve.g.mul(sk).encodeCompressed());
  return addressFromPK(pk, testNet);
};

/**
 * @param  {Array[string]} sks
 * @param  {Number} amount
 * @param  {Number} fee
 * @param  {Boolean} testNet
 */

export const getBoxesFromFewSks = async (sks, amount, fee, testNet = false) => {
  if (
    is.not.array(sks)
    || is.empty(sks)
    || is.not.number(amount)
    || is.not.number(fee)
  ) {
    throw new TypeError('Bad params');
  }

  let boxes = [];
  let result = null;
  for (const sk of sks) {
    const chargeAddress = addressFromSK(sk, testNet);
    const addressBoxes = await getBoxesFromAddress(chargeAddress, testNet);
    const boxesWithSk = importSkIntoBoxes(addressBoxes, sk);

    boxes = [...boxes, ...boxesWithSk];
    result = getSolvingBoxes(boxes, amount, fee);
    if (result !== null) {
      break;
    }
  }

  return result;
};

/**
 * A method that creates outputs
 *
 * @param  {String} recipient
 * @param  {Number} amount
 * @param  {Number} fee
 * @param  {Array} boxesToSpend
 * @param  {String} chargeAddress
 */

export const createOutputs = (recipient, amount, fee, boxesToSpend, chargeAddress) => {
  if (
    is.not.string(recipient)
    || is.not.number(amount)
    || is.not.number(fee)
    || is.not.array(boxesToSpend)
    || is.not.string(chargeAddress)
  ) {
    throw new TypeError('Bad params');
  }

  const globalValue = boxesToSpend.reduce((sum, { value }) => sum + value, 0);
  const boxAssets = getAssetsFromBoxes(boxesToSpend);

  const outputs = [
    {
      address: recipient,
      amount,
      assets: [],
    },
    {
      address: chargeAddress,
      amount: globalValue - amount - fee,
      assets: boxAssets,
    },
  ];

  return outputs;
};

/**
 * @param  {Array} boxesToSpend
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
    throw new TypeError('Bad params');
  }

  const unsignedTransaction = {
    inputs: [],
    dataInputs: [],
    outputs: [],
  };

  const ergoTreeBytes = Buffer.from([0x00, 0x08, 0xcd]);
  const minerErgoTree = constants.minerTree;

  Object.values(outputs).forEach(({ address, amount, assets }) => {
    const tree = Buffer.concat([ergoTreeBytes, pkFromAddress(address)]).toString('hex');

    unsignedTransaction.outputs.push({
      ergoTree: tree,
      assets,
      additionalRegisters: {},
      value: amount,
      creationHeight: height,
    });
  });

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
 * @param  {String} recipient
 * @param  {Number} amount
 * @param  {Number} fee
 * @param  {Array} boxesToSpend
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
    throw new TypeError('Bad params');
  }

  const outputs = createOutputs(recipient, amount, fee, boxesToSpend, chargeAddress);
  const signedTransaction = createTransaction(boxesToSpend, outputs, fee, height);

  return signedTransaction;
};

/**
 * @param  {String} recipient
 * @param  {Number} amount
 * @param  {Number} fee
 * @param  {Array} boxesToSpend
 * @param  {String} chargeAddress
 * @param  {Number} height
 * @param  {Boolean} testNet = false
 */

export const sendTransaction = async (
  recipient, amount, fee, boxesToSpend, chargeAddress, height, testNet = false
) => {
  if (
    is.not.string(recipient)
    || is.not.number(amount)
    || is.not.number(fee)
    || is.not.array(boxesToSpend)
    || is.not.string(chargeAddress)
    || is.not.number(height)
  ) {
    throw new TypeError('Bad params');
  }

  const signedTransaction = formTransaction(
    recipient, amount, fee, boxesToSpend, chargeAddress, height
  );

  const server = testNet ? testNetServer : mainNetServer;

  const res = await server({
    method: 'POST',
    url: '/transactions/send',
    data: signedTransaction,
  });

  return res;
};

/**
 * @param  {String} recipient
 * @param  {Number} amount
 * @param  {Number} fee
 * @param  {Array[String] || String} sk
 * @param  {Boolean} testNet
 */

export const sendWithoutBoxId = async (recipient, amount, fee, sk, testNet = false) => {
  if (
    is.not.string(recipient)
    || is.not.number(amount)
    || is.not.number(fee)
    || (is.not.array(sk) && is.not.string(sk))
    || (is.array(sk) && is.empty(sk))
  ) {
    throw new TypeError('Bad params');
  }

  let chargeAddress; let resolveBoxes;

  if (is.array(sk)) {
    chargeAddress = addressFromSK(sk[0], testNet);
    resolveBoxes = await getBoxesFromFewSks(sk, amount, fee, testNet);
  } else {
    chargeAddress = addressFromSK(sk, testNet);
    const addressBoxes = await getBoxesFromAddress(chargeAddress, testNet);
    const boxesWithSk = importSkIntoBoxes(addressBoxes, sk);

    resolveBoxes = getSolvingBoxes(boxesWithSk, amount, fee);
  }

  if (resolveBoxes === null) {
    throw new Error('Insufficient funds');
  }

  const height = await getCurrentHeight(testNet);

  return sendTransaction(recipient, amount, fee, resolveBoxes, chargeAddress, height, testNet);
};
