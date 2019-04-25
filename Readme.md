# Ergo-js

## Installing

import in body

```
<script src='path_to/ergo.js'></script>
```

## Usage

Default send transaction

```
ergo.sendTransaction(recipient, amount, fee, boxesToSpend, chargeAddress, height)
```

* recipient - Wallet address
* amount - Int
* fee - Int
* boxesToSpend - Array ({id, amount, sk(hex)})
* chargeAddress - Wallet address
* height - Int

Send transaction only with sk

```
ergo.sendWithoutBoxId(recipient, amount, fee, sk) 
```

* recipient - Wallet address
* amount - Int
* fee - Int
* sk - hex

Form transaction and returns it

```
ergo.formTransaction(recipient, amount, fee, boxesToSpend, chargeAddress, height)
```

* recipient - Wallet address
* amount - Int
* fee - Int
* boxesToSpend - Array ({id, amount, sk(hex)})
* chargeAddress - Wallet address
* height - Int

Generate wallet address from pk

```
ergo.walletFromPK(pk, test_net)
```

* pk - hex
* test_net - is testnet? Default - false


## Running the tests

```
npm test
```
