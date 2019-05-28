import BN from 'bn.js';
import { addressFromPK, getResolveBoxes } from '../src/index';
import { sign, verify } from '../src/ergo_schnorr';

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
    expect(() => getResolveBoxes([], "12", 1)).toThrow(TypeError);
    expect(() => getResolveBoxes([], 12, "1")).toThrow(TypeError);
  })

  it('should return one box', () => {
    expect(getResolveBoxes(mockBoxes, 12, 1)).toEqual([{ id: "3", amount: "555" }])
  })

  it('should return 2 boxes', () => {
    expect(getResolveBoxes(mockBoxes, 842, 1)).toEqual([{id: "3", amount: "555"}, { id: "2", amount: "444"}])
  })

  it('should return insufficient funds error', () => {
    expect(() => getResolveBoxes(mockBoxes, 12121212, 1)).toThrow(Error);
  })
})
