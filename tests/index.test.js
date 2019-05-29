import BN from 'bn.js';
import MockAdapter from 'axios-mock-adapter';
import {
  addressFromPK,
  getResolveBoxes,
  getCurrentHeight,
  getBoxesFromAddress,
  addressFromSK,
  importSkIntoBoxes,
  sendWithoutBoxId,
} from '../src/index';
import { sign, verify } from '../src/ergo_schnorr';
import { testNetServer, transactionsServer } from '../src/api';

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

describe('getCurrentHeight function', () => {
  it('should reply 200 and return current height', async () => {
    const mock = new MockAdapter(testNetServer);
    mock.onGet(`/blocks?limit=1`)
      .reply(200, { total: 500 });

    const res = await getCurrentHeight();

    expect(res).toEqual(500);
  });
});

describe('getBoxesFromAddress function', () => {
  it('get error if put bad params', async () => {
    let error;
    try {
      await getBoxesFromAddress(123);
    } catch (e) {
      error = e;
    }
    expect(error).toEqual(new TypeError('Bad type in params'));
  });

  it('should return boxes from address', async () => {
    const mock = new MockAdapter(testNetServer);
    const address = '123';
    mock.onGet(`/transactions/boxes/byAddress/unspent/${address}`)
      .reply(200, [{ id: '1', value: 500 }, { id: '2', value: 500 }]);

    const res = await getBoxesFromAddress(address);

    expect(res).toEqual([{ id: '1', value: 500 }, { id: '2', value: 500 }]);
  });
});

describe('getResolveBoxes function', () => {
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
    expect(() => getResolveBoxes(null, 12, 1)).toThrow(TypeError);
    expect(() => getResolveBoxes(mockBoxes, '12', 1)).toThrow(TypeError);
    expect(() => getResolveBoxes(mockBoxes, 12, '1')).toThrow(TypeError);
    expect(() => getResolveBoxes([], '12', '1')).toThrow(TypeError);
  });

  it('should return one box', () => {
    expect(getResolveBoxes(mockBoxes, 12, 1)).toEqual([{ id: '3', amount: '555' }]);
  });

  it('should return 2 boxes', () => {
    expect(getResolveBoxes(mockBoxes, 842, 1)).toEqual([{ id: '3', amount: '555' }, { id: '2', amount: '444' }]);
  });

  it('get error if boxes dont have solution amount', () => {
    expect(() => getResolveBoxes(mockBoxes, 12121212, 1)).toThrow(Error);
  });
});

describe('importSkIntoBoxes function', () => {
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

describe('addressFromSK function', () => {
  it('should return error with bad params', () => {
    expect(() => addressFromSK(testSK, [])).toThrow(TypeError);
    expect(() => addressFromSK(12, false)).toThrow(TypeError);
  });

  it('should return address', () => {
    expect(addressFromSK(testSK, true)).toEqual(testAddress);
  });
});

describe('sendWithoutBoxId function', () => {
  it('should return error with bad params', async () => {
    let error; let error2; let error3; let error4;

    try {
      await sendWithoutBoxId(1, 1, 1, '12');
    } catch (e) {
      error = e;
    }

    expect(error).toEqual(new TypeError('Bad type in params'));

    try {
      await sendWithoutBoxId('1', 1, 1, 12);
    } catch (e) {
      error2 = e;
    }

    expect(error2).toEqual(new TypeError('Bad type in params'));

    try {
      await sendWithoutBoxId('1', '1', 1, '12');
    } catch (e) {
      error3 = e;
    }

    expect(error3).toEqual(new TypeError('Bad type in params'));

    try {
      await sendWithoutBoxId('1', 1, '1', '12');
    } catch (e) {
      error4 = e;
    }

    expect(error4).toEqual(new TypeError('Bad type in params'));
  });

  it('should send transaction without boxes', async () => {
    const mockTransactionsServer = new MockAdapter(transactionsServer);
    const mockTestnetServer = new MockAdapter(testNetServer);

    mockTestnetServer.onGet(`/transactions/boxes/byAddress/unspent/${testAddress}`)
      .reply(200, [{ id: '1', value: 500 }, { id: '2', value: 500 }]);

    mockTestnetServer.onGet(`/blocks?limit=1`)
      .reply(200, { total: 500 });

    mockTransactionsServer.onPost(`/transactions/send`)
      .reply(200, { id: '1234' });

    const { data } = await sendWithoutBoxId(testAddress, 550, 100, testSK);

    expect(data).toEqual({ id: '1234' });
  });
});
