'use strict';
var DeSportsArtifact = artifacts.require('DeSports.sol');

const assertFail = require("./helpers/assertFail");
const BigNumber = require("bignumber.js");
require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bignumber')(BigNumber))
  .should()
const expect = require('chai').expect

contract('Failure Tests', async function ([owner, better, provider, existing_provider, vandal, bankrupt_user]) {
  let DeSports;
  const test_union = web3.fromAscii("Test Union");
  const test_event = web3.fromAscii("Test Event");
  const test_event2 = web3.fromAscii("Test Event2");

  beforeEach(async function () {
    DeSports = await DeSportsArtifact.new();
    // Send 9000 tokens to providers for testing
    await DeSports.wavesTokenFallback(provider, 100000000000);
    await DeSports.wavesTokenFallback(existing_provider, 100000000000);
    await DeSports.wavesTokenFallback(better, 10000000000);
  });

  it('setFee should not be changed if higher than maxProvidersFee ', async function () {
    await assertFail(async () => { await DeSports.setFee(1000000001, { from: provider }) });
  });

  it('tokenFallback cannot be called if you\'re not the mgotoken address ', async function () {
    await assertFail(async () => { await DeSports.tokenFallback(provider, 1, { from: provider }) });
  });

  it('providers cannot fundUnion with more tokens than they own', async function () {
    await DeSports.createUnion(0x0, { from: provider });
    await assertFail(async () => { await DeSports.fundUnion(0x0, 100000000001, { from: provider }) });
  });

  it('createEvent should not initiate an event', async function () {
    await DeSports.createUnion(0x0, { from: provider });
    await DeSports.startBetting(0x0, { from: provider });
    await assertFail(async () => { await DeSports.createEvent(0x01, 0x0, { from: provider }) });
  });

  it('startBetting should not initiate betting', async function () {
    await DeSports.createUnion(0x0, { from: provider });
    await DeSports.startBetting(0x0, { from: provider });
    await assertFail(async () => { await DeSports.startBetting(0x0, { from: provider }) });
  });


  describe("Setup union and event", async function () {
    beforeEach(async function () {
      await DeSports.createUnion(test_union, { from: provider });
      await DeSports.fundUnion(test_union, 100, { from: provider });
      await DeSports.createEvent(test_event, test_union, { from: provider });
      await DeSports.setQuota(test_union, 0, 20000000000, { from: provider });
    });

    it('quota should not be set unless the quota is above the precision level', async function () {
      // Precision is 10000000000 so this should fail
      await assertFail(async () => { await DeSports.setQuota(test_union, 0, 10000000000, { from: provider }) });
    });

    it('setQuotas should not be set unless you set a quota for every existing event', async function () {
      await DeSports.createEvent(test_event2, test_union, { from: provider });
      // Precision is 10000000000 so this should fail
      await assertFail(async () => { await DeSports.setQuotas(test_union, [10000000001], { from: provider }) });
    });

    it('union should not resolve if the result is higher than the number of events that exist', async function () {
      await assertFail(async () => { await DeSports.resolveUnion(test_union, 2, { from: provider }) });
    });

    it('union should not resolve if the union has already been resolved', async function () {
      await DeSports.resolveUnion(test_union, 0, { from: provider });
      await assertFail(async () => { await DeSports.resolveUnion(test_union, 0, { from: provider }) });
    });

    it('bet should not go through if betting hasnt started', async function () {
      await assertFail(async () => { await DeSports.bet(test_union, 0, 1, 20000000000, { from: better }) });
    });

    it('bet should not go through if union has resolved', async function () {
      await DeSports.resolveUnion(test_union, 0, { from: provider });
      await assertFail(async () => { await DeSports.bet(test_union, 0, 1, 20000000000, { from: better }) });
    });

    it('bet should not go through if the amount is 0', async function () {
      await assertFail(async () => { await DeSports.bet(test_union, 0, 0, 20000000000, { from: better }) });
    });

    it('bet should not go through if the better doesnt have that many tokens', async function () {
      await assertFail(async () => { await DeSports.bet(test_union, 0, 10000000000, 20000000000, { from: better }) });
    });

    it('claimBet should not work if a union has not been resolved', async function () {
      await DeSports.startBetting(test_union, { from: provider });
      await DeSports.bet(test_union, 0, 1, 20000000000, { from: better });
      await assertFail(async () => { await DeSports.claimBet(test_union, { from: better }) });
    });

    it('claimBet should not work if their bet didn\'t win', async function () {
      await DeSports.createEvent(test_event2, test_union, { from: provider });
      await DeSports.startBetting(test_union, { from: provider });
      await DeSports.bet(test_union, 0, 1, 20000000000, { from: better });
      await DeSports.resolveUnion(test_union, 1, { from: provider });
      await assertFail(async () => { await DeSports.claimBet(test_union, { from: better }) });
    });
  });

  it('requestWithdrawal should not work if owner has no balance', async function () {
    await assertFail(async () => { await DeSports.requestWithdrawal(1, true, { from: bankrupt_user }) });
  });
});
