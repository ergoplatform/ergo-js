export const intToVlq = (num) => {
  let x = num;
  let res = Buffer.from([]);
  let r;
  while (parseInt(x / (2 ** 7), 10)) {
    r = x & 0x7F;
    x = parseInt(x / (2 ** 7), 10);
    res = Buffer.concat([res, Buffer.from([(r | 0x80)], null, 1)]);
  }
  r = (x & 0x7F);
  res = Buffer.concat([res, Buffer.from([r], null, 1)]);
  return res;
};

export const outputBytes = (out) => {
  let res = intToVlq(out.value);
  res = Buffer.concat([res, Buffer.from(out.ergoTree, 'hex')]);
  res = Buffer.concat([res, intToVlq(out.creationHeight)]);

  res = Buffer.concat([res, intToVlq(out.assets.length)]);
  const k = out.additionalRegisters.length;
  res = Buffer.concat([res, intToVlq(k)]);
  return res;
};

export const valueSerialize = val => '';

export const inputBytes = (i) => {
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
};

export const distinctTokenList = outputs => []; // TODO: rework this

export const sortBoxes = (boxes) => {
  const sortableKeys = Object.keys(boxes).sort((a, b) => boxes[b].value - boxes[a].value);

  return sortableKeys;
};

export const serializeTx = (tx) => {
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
};

export const type = (value) => {
  const regex = /^\[object (\S+?)\]$/;
  const matches = Object.prototype.toString.call(value).match(regex) || [];

  return (matches[1] || 'undefined').toLowerCase();
};
