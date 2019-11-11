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
    |> flatMap((box) => box.assets);

  const allTokensIds = allAssets
    |> map((asset) => asset.tokenId)
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

  return items[0].height;
};

/**
 * @param {string} address
 * @param {boolean} testNet
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
 * @param  {Number} value
 * @param  {Array} assets
 */
export const getSolvingBoxesWithAssets = (boxes, value, assets) => {
  const remains = { ERG: value };
  assets.forEach((a) => {
    remains[a.tokenId] = (remains[a.tokenId] || 0) + a.amount;
  });

  const boxesToSpend = [];
  const sortedBoxes = sortBoxes(boxes);
  for (const box of sortedBoxes) {
    boxesToSpend.push(box);
    if (remains.ERG > 0) {
      remains.ERG -= box.value;
    }
    box.assets.forEach((a) => {
      if (remains[a.tokenId] > 0) {
        remains[a.tokenId] -= box.value;
      }
    });
    const positiveRemainingToken = Object.values(remains).find((o) => o > 0);

    if (positiveRemainingToken === undefined) {
      return getTenBoxesOrCurrent(boxesToSpend, sortedBoxes);
    }
  }
  return null;
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
  return getSolvingBoxesWithAssets(boxes, amount + fee, []);
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

  return boxes.map((box) => ({
    ...box,
    sk,
  }));
};

/**
 * @param  {string} ergoAdress
 */

export const pkFromAddress = (ergoAdress) => {
  if (
    is.not.string(ergoAdress)
  ) {
    throw new TypeError(`Bad params: ${ergoAdress}`);
  }

  const addrBytes = bs58.decode(ergoAdress);
  return addrBytes.slice(1, 34);
};

/**
 *
 * @param {String} address
 * @returns {boolean}
 */
export const checkAddressValidity = (address) => {
  try {
    const bytes = bs58.decode(address);
    const size = bytes.length;
    const script = bytes.slice(0, size - 4);
    const checksum = bytes.slice(size - 4, size);
    const calculatedChecksum = Buffer.from(blake.blake2b(script, null, 32), 'hex')
      .slice(0, 4);
    return calculatedChecksum.toString('hex') === checksum.toString('hex');
  } catch (e) {
    return false;
  }
};

/**
 *
 * @param {String} address
 * @returns {String}
 */
export const ergoTreeFromAddress = (address) => {
  if (!checkAddressValidity(address)) {
    throw new TypeError(`Bad params:${address}`);
  }
  return Buffer.concat([Buffer.from([0x00, 0x08, 0xcd]), pkFromAddress(address)])
    .toString('hex');
};

export const addressFromPK = (pk, testNet = false) => {
  let NETWORK_TYPE;
  const P2PK_TYPE = 1;

  if (testNet) {
    NETWORK_TYPE = 16;
  } else {
    NETWORK_TYPE = 0;
  }

  const prefixByte = Buffer.from([NETWORK_TYPE + P2PK_TYPE]);
  const contentBytes = Buffer.from(pk, 'hex');
  const checksum = Buffer.from(blake.blake2b(Buffer.concat([prefixByte, contentBytes]), null, 32), 'hex');
  const address = Buffer.concat([prefixByte, contentBytes, checksum])
    .slice(0, 38);

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

  const pk = Buffer.from(curve.g.mul(sk)
    .encodeCompressed());
  return addressFromPK(pk, testNet);
};

export const getBoxesFromSks = async (sks, amount, assets, testNet = false) => {
  let boxes = [];
  for (const sk of sks) {
    const address = addressFromSK(sk, testNet);
    const addressBoxes = await getBoxesFromAddress(address, testNet);
    const boxesWithSk = importSkIntoBoxes(addressBoxes, sk);
    boxes = [...boxes, ...boxesWithSk];
  }
  return getSolvingBoxesWithAssets(boxes, amount, assets);
};

/**
 *
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
  return getBoxesFromSks(sks, amount + fee, [], testNet);
};


/**
 * A method that create charge output
 *
 * @param {Array} meaningfulOutputs
 * @param {Array} boxesToSpend
 * @param {String} chargeAddress
 * @param {Number} height
 * @returns {Array}
 */
export const createChargeOutputs = (meaningfulOutputs, boxesToSpend, chargeAddress, height) => {
  const boxAssets = getAssetsFromBoxes(boxesToSpend);

  const totalValueIn = boxesToSpend.reduce((sum, { value }) => sum + value, 0);
  const totalValueOut = meaningfulOutputs.reduce((sum, { value }) => sum + value, 0);
  const outputs = [];

  const chargeAmount = totalValueIn - totalValueOut;
  if (chargeAmount > 0) {
    outputs.push({
      address: chargeAddress,
      ergoTree: ergoTreeFromAddress(chargeAddress),
      value: chargeAmount,
      assets: boxAssets,
      creationHeight: height,
      additionalRegisters: {},
    });
  } else if (chargeAmount < 0 || boxAssets.length > 0) {
    throw new Error('Insufficient funds');
  }

  return outputs;
};


/**
 * A method that creates outputs
 *
 * @param  {String} recipient
 * @param  {Number} amount
 * @param  {Number} fee
 * @param  {Array} boxesToSpend
 * @param  {String} chargeAddress
 * @param  {Number} height
 */

export const createOutputs = (recipient, amount, fee, boxesToSpend, chargeAddress, height) => {
  if (
    is.not.string(recipient)
    || is.not.number(amount)
    || is.not.number(fee)
    || is.not.number(height)
    || is.not.array(boxesToSpend)
    || is.not.string(chargeAddress)
  ) {
    throw new TypeError('Bad params');
  }

  const outputs = [];
  outputs.push({
    address: recipient,
    ergoTree: ergoTreeFromAddress(recipient),
    value: amount,
    creationHeight: height,
    assets: [],
    additionalRegisters: {},
  });

  if (fee !== null && fee !== undefined && fee > 0) {
    outputs.push({
      address: constants.feeAddress,
      ergoTree: constants.feeErgoTree,
      value: fee,
      creationHeight: height,
      assets: [],
      additionalRegisters: {},
    });
  }

  const chargeOutputs = createChargeOutputs(outputs, boxesToSpend, chargeAddress, height);
  chargeOutputs.forEach((o) => outputs.push(o));

  return outputs;
};

/**
 * Create signed transaction with provided inputs and outputs.
 *
 * @param  {Array} boxesToSpend
 * @param  {Array} outputs
 */
export const createTransaction = (boxesToSpend, outputs) => {
  if (
    is.not.array(boxesToSpend)
    || is.not.array(outputs)
  ) {
    throw new TypeError('Bad params');
  }

  const unsignedTransaction = {
    inputs: [],
    dataInputs: [],
    outputs: [],
  };

  outputs.forEach((o) => unsignedTransaction.outputs.push(o));

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

  const outputs = createOutputs(recipient, amount, fee, boxesToSpend, chargeAddress, height);
  const signedTransaction = createTransaction(boxesToSpend, outputs);

  return signedTransaction;
};

export const broadcastTx = async (
  signedTransaction, testNet = false,
) => {
  const server = testNet ? testNetServer : mainNetServer;
  return server({
    method: 'POST',
    url: '/transactions/send',
    data: signedTransaction,
  });
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
  recipient, amount, fee, boxesToSpend, chargeAddress, height, testNet = false,
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
    recipient, amount, fee, boxesToSpend, chargeAddress, height,
  );

  return broadcastTx(signedTransaction, testNet);
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

  let skArr = sk;
  if (!is.array(skArr)) {
    skArr = [sk];
  }

  const chargeAddress = addressFromSK(skArr[0], testNet);
  const resolveBoxes = await getBoxesFromFewSks(skArr, amount, fee, testNet);

  if (resolveBoxes === null) {
    throw new Error('Insufficient funds');
  }

  const height = await getCurrentHeight(testNet);

  return sendTransaction(recipient, amount, fee, resolveBoxes, chargeAddress, height, testNet);
};

/**
 *
 * @param meaningfulOutputs
 * @param sk
 * @param testNet
 * @returns {Promise<*>}
 */
export const sendWithOutputs = async (meaningfulOutputs, sk, testNet = false) => {
  let skArr = sk;
  if (!is.array(skArr)) {
    skArr = [sk];
  }

  const totalValueOut = meaningfulOutputs.reduce((sum, { value }) => sum + value, 0);

  const assets = getAssetsFromBoxes(meaningfulOutputs);
  const chargeAddress = addressFromSK(skArr[0], testNet);
  const boxesToSpend = await getBoxesFromSks(skArr, totalValueOut, assets, testNet);
  if (boxesToSpend === null) {
    throw new Error('Insufficient funds');
  }

  const height = await getCurrentHeight(testNet);
  const chargeOutputs = createChargeOutputs(meaningfulOutputs, boxesToSpend, chargeAddress, height);
  const outputs = meaningfulOutputs;
  chargeOutputs.forEach((o) => outputs.push(o));

  const tx = createTransaction(boxesToSpend, outputs);

  return broadcastTx(tx);
};
