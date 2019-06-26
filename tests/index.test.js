import BN from 'bn.js';
import MockAdapter from 'axios-mock-adapter';
import {
  addressFromPK,
  getSolvingBoxes,
  getCurrentHeight,
  getBoxesFromAddress,
  addressFromSK,
  importSkIntoBoxes,
  sendWithoutBoxId,
  getBoxesFromFewSks,
  createOutputs,
  getAssetsFromBoxes,
} from '../src/index';
import { sign, verify } from '../src/ergoSchnorr';
import { testNetServer } from '../src/api';

const testAddress = '3WxxVQqxoVSWEKG5B73eNttBX51ZZ6WXLW7fiVDgCFhzRK8R4gmk';
const testSK = '8e6993a4999f009c03d9457ffcf8ff3d840ae78332c959c8e806a53fbafbbee1';

test('P2PK wallet in test network test vector', () => {
  expect(
    addressFromPK('0326df75ea615c18acc6bb4b517ac82795872f388d5d180aac90eaa84de750b942', true)
  ).toBe('3Wxr5EGDUig8cKof1KwySX7KDMLc6mxFmJ9toKZ7oNQV6BUzCs1H');
});

test('simple signature test vector', () => {
  const msgBytes = Buffer.from('1dc01772ee0171f5f614c673e3c7fa1107a8cf727bdf5a6dadb379e93c0d1d00', 'hex');
  const pkBytes = Buffer.from('0326df75ea615c18acc6bb4b517ac82795872f388d5d180aac90eaa84de750b942', 'hex');
  const sk = Buffer.from('f4aa4c487af71fb8b52a3ecd0d398393c2d247d6f0a25275e5d986854b3e2db8', 'hex');
  const signBytes = sign(msgBytes, new BN(sk));

  expect(verify(msgBytes, signBytes, pkBytes)).toBe(true);
});

describe('getCurrentHeight test', () => {
  it('should reply 200 and return current height', async () => {
    const mock = new MockAdapter(testNetServer);
    const currentHeight = 73319;
    mock.onGet('/blocks?limit=1')
      .reply(200, {
        items: [
          {
            id: '147de5d16ea6d346f0eaad7884e12c12a04d90073bb33475f4ff37ed299de037',
            height: currentHeight,
            timestamp: 1560782243190,
            transactionsCount: 1,
            miner: { address: 'mPdcmWTSJ6EGzGvG9xmdoYVsTGM6tk2fNpLVFePUU14nENm4mkbxMiuMLqrhSBYohBWkMbRdgdPpJaPy', name: 'gdPpJaPy' },
            size: 3073,
            difficulty: 13685489664,
            minerReward: 75000000000,
          },
        ],
      });

    const res = await getCurrentHeight(true);

    expect(res).toEqual(currentHeight);
  });
});

describe('getBoxesFromAddress test', () => {
  it('get error if put bad params', async () => {
    let error;
    try {
      await getBoxesFromAddress(123, true);
    } catch (e) {
      error = e;
    }
    expect(error).toEqual(new TypeError('Bad params'));
  });

  it('should return boxes from address', async () => {
    const mock = new MockAdapter(testNetServer);
    const address = '123';
    mock.onGet(`/transactions/boxes/byAddress/unspent/${address}`)
      .reply(200, [{ id: '1', value: 500 }, { id: '2', value: 500 }]);

    const res = await getBoxesFromAddress(address, true);

    expect(res).toEqual([{ id: '1', value: 500 }, { id: '2', value: 500 }]);
  });
});

describe('getSolvingBoxes test', () => {
  const mockBoxes = [
    {
      id: '3',
      value: '555',
    },
    {
      id: '2',
      value: '444',
    },
  ];

  it('should return error with bad params', () => {
    expect(() => getSolvingBoxes(null, 12, 1)).toThrow(TypeError);
    expect(() => getSolvingBoxes(mockBoxes, '12', 1)).toThrow(TypeError);
    expect(() => getSolvingBoxes(mockBoxes, 12, '1')).toThrow(TypeError);
    expect(() => getSolvingBoxes([], '12', '1')).toThrow(TypeError);
  });

  it('should return one box', () => {
    expect(getSolvingBoxes(mockBoxes, 12, 1)).toEqual([mockBoxes[0]]);
  });

  it('should return 2 boxes', () => {
    expect(getSolvingBoxes(mockBoxes, 842, 1)).toEqual([...mockBoxes]);
  });

  it('get error if boxes dont have solution amount', () => {
    expect(getSolvingBoxes(mockBoxes, 1212919231231212, 1)).toEqual(null);
  });
});

describe('importSkIntoBoxes test', () => {
  const mockBoxes = [
    {
      id: '2',
      value: '444',
    },
    {
      id: '3',
      value: '555',
    },
  ];

  it('should return error with bad params', () => {
    expect(() => importSkIntoBoxes(mockBoxes, 1)).toThrow(TypeError);
    expect(() => importSkIntoBoxes([], '123')).toThrow(TypeError);
  });

  it('should import secret key into boxes', () => {
    expect(importSkIntoBoxes(mockBoxes, '2')).toEqual([
      {
        id: '2',
        value: '444',
        sk: '2',
      },
      {
        id: '3',
        value: '555',
        sk: '2',
      },
    ]);
  });
});

describe('addressFromSK test', () => {
  it('should return error with bad params', () => {
    expect(() => addressFromSK(testSK, [])).toThrow(TypeError);
    expect(() => addressFromSK(12, true)).toThrow(TypeError);
  });

  it('should return address', () => {
    expect(addressFromSK(testSK, true)).toEqual(testAddress);
  });
});

describe('getBoxesFromFewSks test', () => {
  const testSks = ['123', '345'];
  const testAddressBoxes = [
    { id: '1', value: 500 },
    { id: '2', value: 500 },
    { id: '3', value: 500 },
    { id: '4', value: 500 },
  ];

  const testResolveBoxes = [
    { id: '1', value: 500, sk: '123' },
    { id: '2', value: 500, sk: '123' },
    { id: '3', value: 500, sk: '345' },
    { id: '4', value: 500, sk: '345' },
  ];

  it('should return error with bad params', async () => {
    let error; let error2; let error3;

    try {
      await getBoxesFromFewSks([], 400, 400);
    } catch (e) {
      error = e;
    }

    expect(error).toEqual(new TypeError('Bad params'));

    try {
      await getBoxesFromFewSks(['123', '123', '123'], '400', 400);
    } catch (e) {
      error2 = e;
    }

    expect(error2).toEqual(new TypeError('Bad params'));

    try {
      await getBoxesFromFewSks(['123', '123', '123'], 400, '400');
    } catch (e) {
      error3 = e;
    }

    expect(error3).toEqual(new TypeError('Bad params'));
  });

  it('should return null if not have resolve boxes', async () => {
    const mockTestnetServer = new MockAdapter(testNetServer);

    mockTestnetServer.onGet(`/transactions/boxes/byAddress/unspent/${addressFromSK(testSks[0], true)}`)
      .reply(200, [testAddressBoxes[0], testAddressBoxes[1]]);

    mockTestnetServer.onGet(`/transactions/boxes/byAddress/unspent/${addressFromSK(testSks[1], true)}`)
      .reply(200, [testAddressBoxes[2], testAddressBoxes[3]]);

    const data = await getBoxesFromFewSks(testSks, 2103123, 100, true);
    expect(data).toEqual(null);
  });

  it('should return solving boxes with secret key from few secret keys', async () => {
    const mockTestnetServer = new MockAdapter(testNetServer);

    mockTestnetServer.onGet(`/transactions/boxes/byAddress/unspent/${addressFromSK(testSks[0], true)}`)
      .reply(200, [testAddressBoxes[0], testAddressBoxes[1]]);

    mockTestnetServer.onGet(`/transactions/boxes/byAddress/unspent/${addressFromSK(testSks[1], true)}`)
      .reply(200, [testAddressBoxes[2], testAddressBoxes[3]]);

    const data = await getBoxesFromFewSks(testSks, 1900, 100, true);
    expect(data).toEqual(testResolveBoxes);
  });
});

describe('sendWithoutBoxId test', () => {
  it('should return error with bad params', async () => {
    let error; let error2; let error3; let error4;
    let error5;

    try {
      await sendWithoutBoxId(1, 1, 1, '12', true);
    } catch (e) {
      error = e;
    }

    expect(error).toEqual(new TypeError('Bad params'));

    try {
      await sendWithoutBoxId('1', 1, 1, 12, true);
    } catch (e) {
      error2 = e;
    }

    expect(error2).toEqual(new TypeError('Bad params'));

    try {
      await sendWithoutBoxId('1', '1', 1, '12', true);
    } catch (e) {
      error3 = e;
    }

    expect(error3).toEqual(new TypeError('Bad params'));

    try {
      await sendWithoutBoxId('1', 1, '1', '12', true);
    } catch (e) {
      error4 = e;
    }

    expect(error4).toEqual(new TypeError('Bad params'));

    try {
      await sendWithoutBoxId('1', 1, [], '12', true);
    } catch (e) {
      error5 = e;
    }

    expect(error5).toEqual(new TypeError('Bad params'));
  });

  it('should return error insufficient funds', async () => {
    let error; let error2;
    const mockTestnetServer = new MockAdapter(testNetServer);

    mockTestnetServer.onGet(`/transactions/boxes/byAddress/unspent/${testAddress}`)
      .reply(200, [{ id: '1', value: 500 }, { id: '2', value: 500 }]);

    const currentHeight = 73319;
    mockTestnetServer.onGet('/blocks?limit=1')
      .reply(200, {
        items: [
          {
            id: '147de5d16ea6d346f0eaad7884e12c12a04d90073bb33475f4ff37ed299de037',
            height: currentHeight,
            timestamp: 1560782243190,
            transactionsCount: 1,
            miner: { address: 'mPdcmWTSJ6EGzGvG9xmdoYVsTGM6tk2fNpLVFePUU14nENm4mkbxMiuMLqrhSBYohBWkMbRdgdPpJaPy', name: 'gdPpJaPy' },
            size: 3073,
            difficulty: 13685489664,
            minerReward: 75000000000,
          },
        ],
      });

    mockTestnetServer.onPost('/transactions/send')
      .reply(200, { id: '1234' });

    try {
      await sendWithoutBoxId(testAddress, 5500000000000000000, 100, [testSK], true);
    } catch (e) {
      error = e;
    }

    expect(error).toEqual(new Error('Insufficient funds'));

    try {
      await sendWithoutBoxId(testAddress, 5500000000000000000, 100, testSK, true);
    } catch (e) {
      error2 = e;
    }

    expect(error2).toEqual(new Error('Insufficient funds'));
  });

  it('should send transaction without boxes with array sk', async () => {
    const testSks = ['123', '345'];
    const currentHeight = 73319;
    const testAddressBoxes = [
      { id: '1', value: 500, assets: [] },
      { id: '2', value: 500, assets: [] },
      { id: '3', value: 500, assets: [] },
      { id: '4', value: 500, assets: [] },
    ];

    const mockTestnetServer = new MockAdapter(testNetServer);

    mockTestnetServer.onGet(`/transactions/boxes/byAddress/unspent/${addressFromSK(testSks[0], true)}`)
      .reply(200, [testAddressBoxes[0], testAddressBoxes[1]]);

    mockTestnetServer.onGet(`/transactions/boxes/byAddress/unspent/${addressFromSK(testSks[1], true)}`)
      .reply(200, [testAddressBoxes[2], testAddressBoxes[3]]);

    mockTestnetServer.onGet('/blocks?limit=1')
      .reply(200, {
        items: [
          {
            id: '147de5d16ea6d346f0eaad7884e12c12a04d90073bb33475f4ff37ed299de037',
            height: currentHeight,
            timestamp: 1560782243190,
            transactionsCount: 1,
            miner: { address: 'mPdcmWTSJ6EGzGvG9xmdoYVsTGM6tk2fNpLVFePUU14nENm4mkbxMiuMLqrhSBYohBWkMbRdgdPpJaPy', name: 'gdPpJaPy' },
            size: 3073,
            difficulty: 13685489664,
            minerReward: 75000000000,
          },
        ],
      });


    mockTestnetServer.onPost('/transactions/send')
      .reply(200, { id: '1234' });

    const { data } = await sendWithoutBoxId(testAddress, 1200, 100, testSks, true);

    expect(data).toEqual({ id: '1234' });
  });

  it('should send transaction without boxes with string sk', async () => {
    const mockTestnetServer = new MockAdapter(testNetServer);
    const currentHeight = 73319;

    mockTestnetServer.onGet(`/transactions/boxes/byAddress/unspent/${testAddress}`)
      .reply(200, [{ id: '1', value: 500, assets: [] }, { id: '2', value: 500, assets: [] }]);

    mockTestnetServer.onGet('/blocks?limit=1')
      .reply(200, {
        items: [
          {
            id: '147de5d16ea6d346f0eaad7884e12c12a04d90073bb33475f4ff37ed299de037',
            height: currentHeight,
            timestamp: 1560782243190,
            transactionsCount: 1,
            miner: { address: 'mPdcmWTSJ6EGzGvG9xmdoYVsTGM6tk2fNpLVFePUU14nENm4mkbxMiuMLqrhSBYohBWkMbRdgdPpJaPy', name: 'gdPpJaPy' },
            size: 3073,
            difficulty: 13685489664,
            minerReward: 75000000000,
          },
        ],
      });

    mockTestnetServer.onPost('/transactions/send')
      .reply(200, { id: '1234' });

    const { data } = await sendWithoutBoxId(testAddress, 550, 100, testSK, true);

    expect(data).toEqual({ id: '1234' });
  });
});

describe('createOutputs test', () => {
  it('should return error with bad params', () => {
    expect(() => createOutputs(3, 12, 1, [], '123')).toThrow(TypeError);
    expect(() => createOutputs('3', '12', 1, [], '123')).toThrow(TypeError);
    expect(() => createOutputs('3', 12, '1', [], '123')).toThrow(TypeError);
    expect(() => createOutputs('3', 12, 1, null, '123')).toThrow(TypeError);
  });

  it('should return outputs', () => {
    const recipient = 'adsfko123ads';
    const chargeAddress = 'asd123sdg';
    const amount = 123;
    const boxes = [
      {
        id: 1,
        value: 426,
        assets: [],
      },
    ];

    const outputs = [
      {
        address: recipient,
        amount,
        assets: [],
      },
      {
        address: chargeAddress,
        amount: 300,
        assets: [],
      },
    ];

    expect(createOutputs(recipient, amount, 3, boxes, chargeAddress)).toEqual(outputs);
  });
});

describe('getAssetsFromBoxes', () => {
  it('should return assets', () => {
    const boxes = [
      {
        box: 1,
        assets: [
          {
            tokenId: '5dd2b04797ea4bff335867385bfd8626d364b89ce58ea36b4ae54af67f9b7fd2',
            amount: 3,
          },
          {
            tokenId: '6ac715c2efdd5938d4136d9c448b50b1b1475d2cca493674b5ce7b779cd6f041',
            amount: 4,
          },
        ],
      },
      {
        box: 2,
        assets: [
          {
            tokenId: '5dd2b04797ea4bff335867385bfd8626d364b89ce58ea36b4ae54af67f9b7fd2',
            amount: 6,
          },
          {
            tokenId: '6ac715c2efdd5938d4136d9c448b50b1b1475d2cca493674b5ce7b779cd6f041',
            amount: 10,
          },
        ],
      },
    ];

    expect(getAssetsFromBoxes(boxes)).toEqual([
      {
        tokenId: '5dd2b04797ea4bff335867385bfd8626d364b89ce58ea36b4ae54af67f9b7fd2',
        amount: 9,
      },
      {
        tokenId: '6ac715c2efdd5938d4136d9c448b50b1b1475d2cca493674b5ce7b779cd6f041',
        amount: 14,
      },
    ]);
  });
});
