
import axios from 'axios';
import constansts from './constants';

export function NetworkError({
  status, message, data, statusText,
}) {
  this.name = 'NetworkError';
  this.message = message || statusText;
  this.status = status;
  this.data = data;
}

NetworkError.prototype = Object.create(Error.prototype);

export const testNetServer = axios.create({
  baseURL: constansts.testnetUrl,
  timeout: 1000 * 5,
  headers: {
    'Content-Type': 'application/json',
  },
});

testNetServer.interceptors.response.use(
  response => Promise.resolve(response),
  error => Promise.reject(new NetworkError(error.response || {})),
);

export const transactionsServer = axios.create({
  baseURL: constansts.url,
  timeout: 1000 * 5,
  headers: {
    'Content-Type': 'application/json',
  },
});

transactionsServer.interceptors.response.use(
  response => Promise.resolve(response),
  error => Promise.reject(new NetworkError(error.response || {})),
);
