import { getTenBoxesOrCurrent, distinctTokenList } from '../src/utils';

describe('getTenBoxesOrCurrent utils func', () => {
  it('should return currentBoxes', () => {
    const currentBoxes = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const allBoxes = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    expect(getTenBoxesOrCurrent(currentBoxes, allBoxes)).toEqual(currentBoxes);
  });

  it('should return 10 boxes', () => {
    const currentBoxes = [1, 2, 3];
    const allBoxes = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(getTenBoxesOrCurrent(currentBoxes, allBoxes)).toEqual([...allBoxes]);
  });
});

describe('distinctTokenList utils func', () => {
  it('Probabilistic length checks', () => {
    for (let i = 0; i < 3; i += 1) {
      const outputs = [];
      const allAssets = new Set();
      for (let j = 0; j < 3; j += 1) {
        const assets = [];
        for (let k = 0; k < 3; k += 1) {
          const tokenId = String(Math.floor(Math.random() * 10));
          assets.push({ tokenId });
          allAssets.add(tokenId);
        }
        outputs.push({ assets });
      }
      expect(distinctTokenList(outputs).length).toEqual(allAssets.size);
    }
  });

  it('List must be ordered correctly', () => {
    const initialIds = [
      'a462cf563d6b10fea2721c9b2de801b3c9620e213c86a0de323337ece13115f5',
      'f84ebeef5e5e38f620435b0d69f31b9a3f235240efcec0e96c51b019d906d242',
      '75786a0ec3e384f2da3ba937bc4229cd9b25033e2b2d497af7ddfedc13ecbcad',
    ];

    const outputs = [
      {
        assets: [{ tokenId: initialIds[0] }, { tokenId: initialIds[1] },
          { tokenId: initialIds[2] }],
      },
      { assets: [{ tokenId: initialIds[1] }, { tokenId: initialIds[0] }] },
      { assets: [{ tokenId: initialIds[2] }, { tokenId: initialIds[0] }] },
    ];

    const distinctTokens0 = initialIds;
    const distinctTokens1 = [initialIds[2], initialIds[0], initialIds[1]];
    const distinctTokens2 = initialIds;

    expect(distinctTokenList(outputs)).toEqual(distinctTokens0);
    expect(distinctTokenList(outputs.reverse())).toEqual(distinctTokens1);
    expect(distinctTokenList([outputs[2], outputs[0], outputs[1]])).toEqual(distinctTokens2);
  });
});
