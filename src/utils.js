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

export const outputBytes = (
  {
    value,
    ergoTree,
    creationHeight,
    assets,
    additionalRegisters,
  },
  tokenIds,
) => {
  let res = intToVlq(value);
  res = Buffer.concat([res, Buffer.from(ergoTree, 'hex')]);
  res = Buffer.concat([res, intToVlq(creationHeight)]);

  res = Buffer.concat([res, intToVlq(assets.length)]);
  for (let i = 0; i < assets.length; i += 1) {
    const assetId = assets[i].tokenId;
    const assetIndex = tokenIds.indexOf(assetId);
    if (assetIndex === -1) {
      res = Buffer.concat([res, Buffer.from(assetId, 'hex')]);
    } else {
      res = Buffer.concat([res, intToVlq(assetIndex)]);
      res = Buffer.concat([res, intToVlq(assets[i].amount)]);
    }
  }
  const k = additionalRegisters.length;
  res = Buffer.concat([res, intToVlq(k)]);
  return res;
};

export const valueSerialize = () => '';

export const inputBytes = (i) => {
  let res = Buffer.from(i.boxId, 'hex');
  const sp = i.spendingProof;
  res = Buffer.concat([res, intToVlq(sp.proofBytes.length)]);
  res = Buffer.concat([res, Buffer.from(sp.proofBytes, 'hex')]);
  res = Buffer.concat([res, intToVlq(sp.extension.length)]);

  Object.keys(sp.extension).forEach((k) => {
    res += intToVlq(k);
    res += valueSerialize(sp.extension[k]);
  });

  return res;
};

export const distinctTokenList = (outputs) => {
  const tokenList = outputs.map((x) => x.assets.map((a) => a.tokenId));
  const flatTokenList = tokenList.flat();
  const seenTokens = new Set();
  const res = [];
  for (let i = 0; i < flatTokenList.length; i += 1) {
    const currId = flatTokenList[i];
    if (!(currId in seenTokens)) {
      res.push(currId);
      seenTokens.add(currId);
    }
  }
  return res;
};

export const sortBoxes = (boxes) => {
  const sortableKeys = Object.keys(boxes).sort((a, b) => boxes[b].value - boxes[a].value);
  const sortableBoxes = sortableKeys.map((k) => boxes[k]);

  return sortableBoxes;
};

export const getTenBoxesOrCurrent = (currBoxes, allBoxes) => {
  if (currBoxes.length > 10) {
    return currBoxes;
  }
  const tenBoxesIncludeCurrent = currBoxes.concat(allBoxes.slice(currBoxes.length, 10));

  return tenBoxesIncludeCurrent;
};

export const serializeTx = (tx) => {
  let res = intToVlq(tx.inputs.length);

  Object.values(tx.inputs).forEach((v) => {
    res = Buffer.concat([res, inputBytes(v)]);
  });
  res = Buffer.concat([res, intToVlq(tx.dataInputs.length)]);

  tx.dataInputs.forEach((i) => {
    res = Buffer.concat([res, Buffer.from(i.boxId, 'hex')]);
  });

  const distinctIds = distinctTokenList(tx.outputs);

  res = Buffer.concat([res, intToVlq(distinctIds.length)]);

  Object.values(distinctIds).forEach((v) => {
    res = Buffer.concat([res, Buffer.from(v, 'hex')]);
  });

  res = Buffer.concat([res, intToVlq(tx.outputs.length)]);
  Object.values(tx.outputs).forEach((v) => {
    res = Buffer.concat([res, outputBytes(v, distinctIds)]);
  });

  return res;
};
