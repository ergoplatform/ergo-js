# Ergo-js

## Installing

import in body

```html
<script src='path_to/dist/ergo.js'></script> 
```

With npm:

```sh
npm install @ergoplatform/ergo-js
```

Or yarn:
```sh
yarn add @ergoplatform/ergo-js
```

## Usage

### In body:

```html
<script src='path_to/ergo.js'></script>
<script>
  ergo.sendTransaction(...)
</script> 
```

### In Node.js:

```javascript
const ergo = require('@ergoplatform/ergo-js');

ergo.sendTransaction(...)
```

### Import syntax:

```javascript
import * as ergo from '@ergoplatform/ergo-js'

ergo.sendTransaction(...)

// or destructuring assignment

import { sendTransaction } from '@ergoplatform/ergo-js'

sendTransaction(...)
```

## Documentation

### Default send transaction

```javascript
import { sendTransaction } from '@ergoplatform/ergo-js'

* @param  {String} recipient
* @param  {Number} amount
* @param  {Number} fee
* @param  {Array[Object({ id: number, amount: number, sk(hex): string })]}} boxesToSpend
* @param  {String} chargeAddress
* @param  {Number} height

sendTransaction(recipient, amount, fee, boxesToSpend, chargeAddress, height)
```

### Send transaction only with sk

```javascript
import { sendWithoutBoxId } from '@ergoplatform/ergo-js'

* @param  {String} recipient
* @param  {Number} amount
* @param  {Number} fee
* @param  {String || Array[String]} sk

sendWithoutBoxId(recipient, amount, fee, sk) 
```

### Form transaction and returns it

```javascript
import { formTransaction } from '@ergoplatform/ergo-js'

* @param  {String} recipient
* @param  {Number} amount
* @param  {Number} fee
* @param  {Array[Object({ id: number, amount: number, sk(hex): string })]} boxesToSpend
* @param  {String} chargeAddress
* @param  {Number} height

formTransaction(recipient, amount, fee, boxesToSpend, chargeAddress, height)
```

### Generate charge address from public key

```javascript
import { addressFromPK } from '@ergoplatform/ergo-js'

* @param  {string} pk
* @param  {boolean} testNet

addressFromPK(pk, test_net)
```

### Generate charge address from private key

```javascript
import { addressFromSK } from '@ergoplatform/ergo-js'

* @param  {string} sk
* @param  {boolean} testNet

addressFromSK(pk, test_net)
```
