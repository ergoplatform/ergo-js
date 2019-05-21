# Ergo-js

## Installing

import in body

```
<script src='path_to/dist/ergo.js'></script> 
```

With npm:

```
npm install @ergoplatform/ergo-js
```

Or yarn:
```
yarn add @ergoplatform/ergo-js
```

# Usage

### In body:

```
<script src='path_to/ergo.js'></script>
<script>
  ergo.sendTransaction(...)
</script> 
```

### In Node.js:

```
const ergo = require('@ergoplatform/ergo-js');

ergo.sendTransaction(...)
```

### Import syntax

```
import * as ergo from '@ergoplatform/ergo-js'

ergo.sendTransaction(...)

// or destructuring assignment

import { sendTransaction } from '@ergoplatform/ergo-js'

sendTransaction(...)
```

# Documentation

### Default send transaction

```
import { sendTransaction } from '@ergoplatform/ergo-js'

* @param  {String} recipient
* @param  {Number} amount
* @param  {Number} fee
* @param  {Array[object]} boxesToSpend
* @param  {String} chargeAddress
* @param  {Number} height

sendTransaction(recipient, amount, fee, boxesToSpend, chargeAddress, height)
```

### Send transaction only with sk

```
import { sendWithoutBoxId } from '@ergoplatform/ergo-js'

* @param  {string} recipient
* @param  {number} amount
* @param  {number} fee
* @param  {string} sk

sendWithoutBoxId(recipient, amount, fee, sk) 
```

### Form transaction and returns it

```
import { formTransaction } from '@ergoplatform/ergo-js'

* @param  {String} recipient
* @param  {Number} amount
* @param  {Number} fee
* @param  {Array[object({ id: number, amount: number, sk(hex): string })]} boxesToSpend
* @param  {String} chargeAddress
* @param  {Number} height

formTransaction(recipient, amount, fee, boxesToSpend, chargeAddress, height)
```

### Generate wallet address from public key

```
import { walletFromPK } from '@ergoplatform/ergo-js'

* @param  {string} pk
* @param  {boolean} testNet

walletFromPK(pk, test_net)
```

### Generate wallet address from private key

```
import { walletFromSK } from '@ergoplatform/ergo-js'

* @param  {string} sk
* @param  {boolean} testNet

walletFromSK(pk, test_net)
```
