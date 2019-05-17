# Ergo-js

## Installing

import in body

```
<script src='path_to/ergo.js'></script>
```

# Usage

## Default send transaction

```
* @param  Wallet address{String} recipient
* @param  {Number} amount
* @param  {Number} fee
* @param  {Array[object]} boxesToSpend
* @param  WalletAddress{String} chargeAddress
* @param  {Number} height

ergo.sendTransaction(recipient, amount, fee, boxesToSpend, chargeAddress, height)
```

## Send transaction only with sk

```
* @param  Wallet address{string} recipient
* @param  {number} amount
* @param  {number} fee
* @param  {string} sk

ergo.sendWithoutBoxId(recipient, amount, fee, sk) 
```

## Form transaction and returns it

```
* @param  Wallet address{String} recipient
* @param  {Number} amount
* @param  {Number} fee
* @param  {Array[object({ id: number, amount: number, sk(hex): string })]} boxesToSpend
* @param  {String} chargeAddress
* @param  {Number} height

ergo.formTransaction(recipient, amount, fee, boxesToSpend, chargeAddress, height)
```

## Generate wallet address from public key

```
* @param  {string} pk
* @param  {boolean} testNet

ergo.walletFromPK(pk, test_net)
```

## Generate wallet address from private key

```
* @param  {string} sk
* @param  {boolean} testNet

ergo.walletFromSK(pk, test_net)
```

# Running the tests

```
npm test
```
