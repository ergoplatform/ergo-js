import { walletFromPK, sendTransaction } from './index'

test('simple P2PK wallet in test network test vector', () => {
  expect(walletFromPK('0326df75ea615c18acc6bb4b517ac82795872f388d5d180aac90eaa84de750b942', true)).toBe('3Wxr5EGDUig8cKof1KwySX7KDMLc6mxFmJ9toKZ7oNQV6BUzCs1H');
});

test('simple signature test vector', () => {
  expect(sendTransaction('0326df75ea615c18acc6bb4b517ac82795872f388d5d180aac90eaa84de750b942', true)).toBe('3Wxr5EGDUig8cKof1KwySX7KDMLc6mxFmJ9toKZ7oNQV6BUzCs1H');
});