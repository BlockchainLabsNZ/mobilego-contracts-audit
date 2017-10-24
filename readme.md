# DeSports Smart Contract Documentation

## Compiling and Interacting with the Smart Contract
*For the QA team.*

1. Open [Remix IDE](https://remix.ethereum.org/)
2. Copy and paste the contents of the file `DeSports.sol`
3. Under `Compile` click `Start to compile`
4. Under `Run` set `Gas limit` to `
5. Click `Create`

You're now able to interact with the contract. Choose which address to interact from under `Account`. Pay attention to which one is the `owner` and which you have set to be Providers.

## Internal Structure

Please refer to the diagram in `desports_scheme.png` while reading this documentation.!

### PreciseMath

Since there is no native floating-point type in Solidity, the following substitutes are introduced for multiplying and dividing:
`preciselyDivide(1, 4)` returns `2500000000`. The last 10 decimals in this number (all of them in this case) represent the decimals behind the decimal point. This will be interpreted as `0.25`, so any variable holding such a result should be prefixed with "precise" in the code for good measure, such as, for instance, the quotas and the fees. when we want to multiply with a "precise" number, we use `preciselyMultiply(12, 2500000000)` which returns `3`, as it is interpreted as `12 * 0.25`. Be careful, as `preciselyMultiply` rounds off its result, and it is not in the "precise" format. This is because the functions are here to satisfy the limited DeSports use cases, and for instance the multiplication of two floating points and other functions are not necessary.

### KillSwitch

For security reasons, this contract introduces a modifier `lockable` that prevents any functions with such modifiers from being called. Calling`changeContractStatus(false)`as the owner makes all such functions unusable.

### DeSports

The main contract that is deployed, in which all the functionality is implemented. It inherits the previous two contracts.

### Lockable Functions

In the state of emergency, or a discovered bug, all functions can be locked (prevented from being called by anyone) by the `owner` except the following:

* `requestWithdrawal`
* `confirmWithdrawal`
* `claimBet`

This is done so that any user can claim and request that their funds be extracted from the contract. While freezing all other functions, the contract would essentially enter a 'refund' phase.

by also locking `tokenFallback` and `wavesTokenFallback`, we prevent any MGO from being further contributed to this contract.

### Events

Every function has along with it an event, allowing filtering by relevant paramenters.


## External Structure

### Waves MobileGo Handling
MobileGo / GameCredits Inc. (represented by the `owner` address) provides a link to the Waves blockchain, and allows you to both (logically) deposit and withdraw Waves MobileGo tokens from this smart contract. This is done by a service that monitors both Ethereum and Waves and, after getting security approval (which is sometimes even manual) it makes the relevant updates. For more information, check the functions `wavesTokenFallback`, `requestWithdrawal`, and `confirmWithdrawal`.


## DeSports Contract External API

### Owner's API

`owner` is the address that initially deployed the contract, i.e. the one owned by MobileGo / GameCredits Inc.

#### changeWithdrawalFee(uint40 preciseNewFee)
When a user wishes to withdraw MGO from the smart contract to their address on Ethereum or Waves, this is the fee (in precise format) that will be charged by the `owner`.

#### confirmWithdrawal(address requester)
When a user requests a withdrawal, they either ask for a withdrawal on Ethereum or on Waves. In the case of a Waves withdrawal (`ethereum == false`), the transaction was handled by the owner on the Waves blockchain, and this function call is simply an announcement. In the case of an Ethereum withdrawal (`ethereum == true`), the function call also performs the MGO transfer to `requester`.

#### wavesTokenFallback(address \_from, uint \_value) 
The `owner`'s service monitors the incoming transactions on the Waves blockchain, and when a deposit to the Waves address in `wavesAddresses[owner]` from the Waves address in `wavesAddresses[_from]` is detected, the `owner` calls this function to increase the cumulative MGO balance of `_from` by `_value` on the smart contract.

### Provider's API

The providers are a class of registered users which make it their business model to provide reputable data about eSports matches, and use their own funds to guarantee precise quota distributions.
Since the `owner` is also a provider, its services will be delivered by automatized middleware services. The `owner` is going to be processing sources of truths in order to post the most accurate and trustworthy information available. Other parties may do so as well, and the choice of which of the providers to trust is a choice left to the users.

### setIP_Port(uint8 index, bytes32 ip_port)
A Provider announces the IP and port where he can be pinged with any custom protocol of his own. This assumes that there may be a necessity for a protocol outside the realm of a smart contract, and allows the routing information to be public on the blockchain. The string in `ip_port` should be of the format `127.0.0.1:8545`.

#### setFee(uint40 preciseNewFee)
A provider changes the fee that they make on each betting withdrawal.

#### createUnion(bytes32 unionName)
A union is an abstract model consisting of multiple events, exactly one of which is going to occur. It is created by a provider. When this function is called, the sender is registered as the provider for the new union with the name `unionName`, unless the union already exists, in which case the function simply returns false.

#### fundUnion(bytes32 unionName, uint amount)
The Provider deposits money to guarantee that every bet will be paid out, in full, and for the amount that was betted on, and for the quota that it was betted on.

#### createEvent(bytes32 eventName, bytes32 unionName)
An event (an abstract object that has a `preciseQuota`, inversely proportional to its probability of occurring) is created. An event relates to a virtual possibility in an eSports match. A user can bet on this possibility taking place. The event as a data structure also contains values for recording the amount of MGO that is betted on it, along with the total claim of MGO in the case that event comes to pass.

#### startBetting(bytes32 unionName)
Starts the betting in a union. This means that any event can be betted on. This function can be called only once for every union. No new events in the union can be created by the Provider after this function is called.

#### setQuota(bytes32 unionName, uint8 eventIndex, uint preciseQuota)
The provider changes the quota for an event number `eventIndex` in a union `unionName`.

#### setQuotas(bytes32 unionName, uint[] preciseQuotas)
All the quotas in an event are changed. This function is introduced in order to avoid potential openings that may occur when quota changes in the same union fail to be confirmed in the same block.

#### lockBetting(bytes32 unionName, bool newStatus)
The provider changes the state indicating whether a union can be betted on or not. Betting can be locked during certain points of a match, or previous to it; the timing is entirely the Provider's choice.

#### resolveUnion(bytes32 unionName, uint8 result)
The provider announces which of the events in an union has occurred. If the cumulative amount of funds betted on all the events in the union is not enough to cover the quota distribution for the event that has taken place, the provider compensates for it with his MGO. If the total amount accrued exceeds the amount necessary for the distribution, the provider gets the surplus. On average over time, this evens out the gains and losses for the provider to `0`, with the assumption that the quotas are, on average, accurate (thus if the provider provides sub-par data, they may lose money). The real business model for the providers is the fee that they take once the users claim their won money.

### End User's API

#### associateAddresses(bytes32 wavesAddressStart, byte wavesAddressEnd)
Any user on the platform, be they provider, `owner`, or neither, may associate their Ethereum address with their Waves one of these purposes:

* Waves Deposit
* Waves Withdrawal
* An announcement where to send Waves MGO deposits (if `owner`)

For the purpose of **depositing Waves MGO**, the end user must do this before each deposit and only with a new and unused address. Then, they send Waves MGO to that address, and from that address to the `owner`'s address. This is done for security purposes and is **imperative** that the users do Waves MobileGo Import as described. Otherwise the service may not recognize your deposit as valid, may return it, or in the worst case scenario, the deposit may be lost.

#### tokenFallback(address \_from, uint \_value, bytes \_data)
An ERC223 token fallback function that handles incoming MGO transactions to the smart contract. The balance of the sending address is updated.

#### bet(bytes32 unionName, uint8 eventIndex, uint amount)
A user transfers `amount` of his MGO deposited to the contract to the pool of the event number `eventIndex` in a union `unionName`. The amount of MGO that they will be able to claim depends on the current quota of the event. A user may bet on the same event multiple  times, capturing multiple quotas, each of which is recorded. A user may, at any point, also bet on multiple events in the same union, diversifying their investment. If the user is a banned provider, this action is restricted.

#### claimBet(bytes32 unionName, uint8 eventIndex) 
If a user has won a bet, they call this function in order to have the owed balance transferred to their balance on the smart contract. If the user is a banned provider, this action is restricted. Also, if you try to reclaim any of the bets from any of the banned providers, you will get back the same amount of money to the one you investment, tantamount to a hard refund.

#### requestWithdrawal(uint amount, bool ethereum) 
A user requests that the `amount` MGO be distributed to their Ethereum address (`msg.sender`) if `ethereum == true`, or to their Waves address `wavesAddresses[msg.sender]`.