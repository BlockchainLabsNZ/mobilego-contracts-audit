### KILL SWITCH

`modifier only`

Make sure 'only' modifier works correctly.

- [ ] Tested


 ### DESPORTS: OWNER FUNCTIONS

`function changeWithdrawalFee`

Check fee is updated only when called by owner.

- [ ] Tested

`function confirmWithdrawal`

Check withdrawal has occured, as well as still operational during contractLocked status.

- [ ] Tested

`function wavesTokenFallback`

Assert balance is adjusted to reflect deposit.

- [ ] Tested

 ### DESPORTS: PROVIDER / RESOLVER FUNCTIONS

`function setIP_Port`

Make sure only provider can set IP port and check to make sure it is set correctly.

- [ ] Tested

`function setFee`

Check fee is set correctly.

- [ ] Tested

`function createUnion`

Should only be called by provider.

- [ ] Tested

`function fundUnion`

Should only be called by provider.

- [ ] Tested

`function createEvent`

Should only be called by provider.

- [ ] Tested

`function startBetting`

Check to make sure bets of event are enabled 

- [ ] Tested

`function setQuota`

Assert quotas are correctly updated.

- [ ] Tested

`function setQuotas`

Assert quotas are correctly updated.

- [ ] Tested

`function lockBetting`

Make sure you can't bet while locked, and that you can resume betting once unlocked.

- [ ] Tested

`function resolveUnion`

Check that function can't be resolved by provider more than once.

- [ ] Tested

 ### DESPORTS: USER FUNCTIONS

`function associateAddresses`

Make sure Ethereum address is successfully matched to the Waves address

- [ ] Tested

`function tokenFallback`

Implements Ethereum MGO ERC223 token fallback function as deposit.

- [ ] Tested

`function bet`

Test negative amount, 0 amount, large amount, test timings to make sure it only works when betting has started, not before, and not after.

- [ ] Tested

`function claimBet`

Check balances are updated, as well as still operational during contractLocked status.

- [ ] Tested

`function requestWithdrawal`

Withdraw an amount of Waves to an internal account or an external address.

- [ ] Tested

`function events`

Fetch result of mapping inside a struct.

- [ ] Tested



