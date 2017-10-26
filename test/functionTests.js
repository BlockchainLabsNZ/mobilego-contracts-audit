'use strict';
var DeSportsArtifact = artifacts.require('DeSports.sol');

const assertFail = require("./helpers/assertFail");
const BigNumber = require("bignumber.js");
require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bignumber')(BigNumber))
  .should()
const expect = require('chai').expect

contract('Function Tests', async function ([owner, better, provider, existing_provider, vandal]) {
  let DeSports;
  const test_union = web3.fromAscii("Test Union");
  const test_event = web3.fromAscii("Test Event");

  beforeEach(async function () {
    DeSports = await DeSportsArtifact.new();
    // Send 9000 tokens to providers for testing
    await DeSports.wavesTokenFallback(provider, 9001);
    await DeSports.wavesTokenFallback(existing_provider, 9001);
  });

  it('changeWithdrawalFee only works for owner', async function () {
    assert.equal(await DeSports.preciseWithdrawalFee(), 100000000, "Default is 100mil");
    await assertFail(async () => { await DeSports.changeWithdrawalFee(123, { from: vandal }) }, "Other accounts cannot call this function");
    assert.equal(await DeSports.preciseWithdrawalFee(), 100000000, "Fee should not have changed");

    const { logs } = await DeSports.changeWithdrawalFee(123, { from: owner });
    const event = logs.find(e => e.event === 'WithdrawalFeeChange');
    expect(event).to.exist;
    assert.equal(await DeSports.preciseWithdrawalFee(), 123, "Fee should now be changed to 123");
  });

  it('createUnion can create unions', async function () {
    const { logs } = await DeSports.createUnion(test_union, { from: provider });
    const event = logs.find(e => e.event === 'UnionCreation');
    expect(event).to.exist;
    let new_union = await DeSports.unions(test_union);
    expect(new_union).to.exist;
    // new_union[0] == uint preciseFee;
    assert.equal(new_union[0], provider);
  });

  it('createUnion cant create a union if it already exists', async function () {
    await DeSports.createUnion(test_union, { from: provider });
    let new_union = await DeSports.unions(test_union);
    // new_union[0] == uint preciseFee;
    assert.equal(new_union[0], provider);
    // Creating the union again should return false
    await DeSports.createUnion(test_union, { from: vandal });
    // So the provider should not have changed
    // new_union[0] == uint preciseFee;
    assert.equal(new_union[0], provider);
  });

  describe('lockable functions', async function () {
    const existing_union = web3.fromAscii("Test Union 2");
    const existing_event = web3.fromAscii("Test Event 2");
    beforeEach(async function () {
      await DeSports.createUnion(existing_union, { from: existing_provider });
      await DeSports.createEvent(existing_event, existing_union, { from: existing_provider });
      await DeSports.changeContractStatus(true);
      assert.equal(await DeSports.contractLocked(), true, "Contract status should be locked");
    });

    it('createUnion should be lockable', async function () {
      await assertFail(async () => { await DeSports.createUnion(test_union) }, "Function should not be callable while locked");
      await DeSports.changeContractStatus(false);
      const { logs } = await DeSports.createUnion(test_union);
      const event = logs.find(e => e.event === 'UnionCreation');
      expect(event).to.exist;
      let new_union = await DeSports.unions(test_union);
      expect(new_union).to.exist;
    });

    it('fundUnion should be lockable', async function () {
      await assertFail(async () => { await DeSports.fundUnion(existing_union, 123, { from: existing_provider }) }, "Function should not be callable while locked");
      await DeSports.changeContractStatus(false);
      const { logs } = await DeSports.fundUnion(existing_union, 123, { from: existing_provider });
      const event = logs.find(e => e.event === 'UnionFunding');
      expect(event).to.exist;
      let union = await DeSports.unions(existing_union);
      // union[1] == uint providerFund;
      assert.equal(union[1], 123, "The provider fund should be increased by 123");
    });

    it('setFee should be lockable', async function () {
      await assertFail(async () => { await DeSports.setFee(123, { from: provider }) }, "Function should not be callable while locked");
      await DeSports.changeContractStatus(false);
      const { logs } = await DeSports.setFee(123, { from: provider });
      const event = logs.find(e => e.event === 'Fee');
      expect(event).to.exist;
      let provider_data = await DeSports.providers(provider);
      assert.equal(provider_data[0].toNumber(), 123);
    });

    it('createEvent should be lockable', async function () {
      await assertFail(async () => { await DeSports.createEvent(test_event, existing_union, { from: existing_provider }) }, "Function should not be callable while locked");
      await DeSports.changeContractStatus(false);
      const { logs } = await DeSports.createEvent(test_event, existing_union, { from: existing_provider });
      const event = logs.find(e => e.event === 'EventCreation');
      expect(event).to.exist;
    });

    it('startBetting should be lockable', async function () {
      await assertFail(async () => { await DeSports.startBetting(existing_union, { from: existing_provider }) }, "Function should not be callable while locked");
      await DeSports.changeContractStatus(false);
      const { logs } = await DeSports.startBetting(existing_union, { from: existing_provider });
      const event = logs.find(e => e.event === 'BettingStarted');
      expect(event).to.exist;
    });

    it('setQuota should be lockable', async function () {
      await assertFail(async () => { await DeSports.setQuota(existing_union, 0, 10000000001, { from: existing_provider }) }, "Function should not be callable while locked");
      await DeSports.changeContractStatus(false);
      const { logs } = await DeSports.setQuota(existing_union, 0, 10000000001, { from: existing_provider });
      const event = logs.find(e => e.event === 'Quota');
      expect(event).to.exist;
    });

    it('setQuotas should be lockable', async function () {
      await assertFail(async () => { await DeSports.setQuotas(existing_union, [, new BigNumber("10000000001")], { from: existing_provider }) }, "Function should not be callable while locked");
      await DeSports.changeContractStatus(false);
      const { logs } = await DeSports.setQuotas(existing_union, [new BigNumber("10000000001")], { from: existing_provider });
      const event = logs.find(e => e.event === 'Quotas');
      expect(event).to.exist;
    });

    it('lockBetting should be lockable', async function () {
      await assertFail(async () => { await DeSports.lockBetting(existing_union, true, { from: existing_provider }) }, "Function should not be callable while locked");
      await DeSports.changeContractStatus(false);
      const { logs } = await DeSports.lockBetting(existing_union, true, { from: existing_provider });
      const event = logs.find(e => e.event === 'BettingLock');
      expect(event).to.exist;
    });

    it('resolveUnion should be lockable', async function () {
      await assertFail(async () => { await DeSports.resolveUnion(existing_union, 0, { from: existing_provider }) }, "Function should not be callable while locked");
      await DeSports.changeContractStatus(false);
      const { logs } = await DeSports.resolveUnion(existing_union, 0, { from: existing_provider });
      const event = logs.find(e => e.event === 'UnionResolution');
      expect(event).to.exist;
    });

    describe('user functions (lockable)', async function () {
      it('associateAddresses should be lockable', async function () {
        await assertFail(async () => { await DeSports.associateAddresses(0x1, 0x2, { from: existing_provider }) }, "Function should not be callable while locked");
        await DeSports.changeContractStatus(false);
        const { logs } = await DeSports.associateAddresses(0x1, 0x2, { from: existing_provider });
        const event = logs.find(e => e.event === 'AddressesAssociation');
        expect(event).to.exist;
      });
    });
  });
});
