'use strict';
var DeSportsArtifact = artifacts.require('DeSports.sol');

const assertFail = require("./helpers/assertFail");
const BigNumber = require("bignumber.js");
require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bignumber')(BigNumber))
  .should()
const expect = require('chai').expect

contract('Function Tests', async function ([owner, better, better2, provider, existing_provider, vandal]) {
  let DeSports;
  const test_union = web3.fromAscii("Test Union");
  const test_event = web3.fromAscii("Test Event");

  beforeEach(async function () {
    DeSports = await DeSportsArtifact.new();
    // Send tokens for testing
    await DeSports.wavesTokenFallback(provider, 1000);
    await DeSports.wavesTokenFallback(existing_provider, 1000);
    await DeSports.wavesTokenFallback(better, 100);
    await DeSports.wavesTokenFallback(better2, 100);
  });

  it('fallback function should revert', async function () {
    await assertFail(async () => { await DeSports.sendTransaction({ from: vandal }) });
  });

  it('confirmWithdrawal should be possible', async function () {
    await DeSports.associateAddresses(0x1, 0x2, { from: better });
    await DeSports.requestWithdrawal(1, false, { from: better });
    let { logs } = await DeSports.confirmWithdrawal(better, { from: owner });
    const event = logs.find(e => e.event === 'WithdrawalConfirmation');
    expect(event).to.exist;
  });

  it('setIP_Port should save ip_port', async function () {
    let ip_port = web3.fromAscii("192.168.0.1:80");
    let { logs } = await DeSports.setIP_Port(0, ip_port);
    const event = logs.find(e => e.event === 'IP_Port');
    expect(event).to.exist;
    assert.equal(event['args']['provider'], owner);
    assert.include(event['args']['ip_port'], ip_port);
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
    await assertFail(async () => { await DeSports.createUnion(test_union, { from: vandal }) });
    // So the provider should not have changed
    // new_union[0] == uint preciseFee;
    assert.equal(new_union[0], provider);
  });

  describe('setup union and event', async function () {
    const existing_union = web3.fromAscii("Test Union 2");
    const existing_event = web3.fromAscii("Event option 1");
    const existing_event2 = web3.fromAscii("Event option 2");
    beforeEach(async function () {
      await DeSports.createUnion(existing_union, { from: existing_provider });
      await DeSports.createEvent(existing_event, existing_union, { from: existing_provider });
      await DeSports.createEvent(existing_event2, existing_union, { from: existing_provider });
    });

    describe('test betting', async function () {
      beforeEach(async function () {
        await DeSports.setQuotas(existing_union, [new BigNumber("20000000000"), new BigNumber("20000000000")], { from: existing_provider });
        await DeSports.fundUnion(existing_union, 10, { from: existing_provider });
        await DeSports.startBetting(existing_union, { from: existing_provider });
      });

      it('bet is not valid if it is greater than the amount the union has been funded', async function () {
        await assertFail(async () => { await DeSports.bet(existing_union, 0, 20, new BigNumber("20000000000"), { from: better }) });
      });

      it('events() function should return event info', async function () {
        let events = await DeSports.events(existing_union, 0);
        assert.include(events[0], existing_event, "the event name should contain the text from existing_event padded with 0's");
        assert.equal(events[1].toNumber(), 20000000000);
        assert.equal(events[2].toNumber(), 0);
      });

      it('betting shouldnt be valid after a union is resolved', async function () {
        await DeSports.resolveUnion(existing_union, 0, { from: existing_provider });
        await assertFail(async () => { await DeSports.bet(existing_union, 0, 10, new BigNumber("20000000000"), { from: better }) });
      });

      it('betting should fail if the quota is entered incorrectly', async function () {
        await assertFail(async () => { await DeSports.bet(existing_union, 0, 10, new BigNumber("20000000001"), { from: better }) });
      });

      it('lockbetting should halt betting', async function () {
        await DeSports.lockBetting(existing_union, true, { from: existing_provider });
        await assertFail(async () => { await DeSports.bet(existing_union, 0, 10, new BigNumber("20000000000"), { from: better }) });1
      });

      it('only the person who placed the bet, can claim the bet', async function () {
        await DeSports.bet(existing_union, 0, 10, new BigNumber("20000000000"), { from: better });
        await DeSports.resolveUnion(existing_union, 0, { from: existing_provider });
        await assertFail(async () => { await DeSports.claimBet(existing_union, { from: vandal }) });
      });

      it('a bet should return nothing after an unsuccesful bet', async function () {
        await DeSports.bet(existing_union, 0, 10, new BigNumber("20000000000"), { from: better });
        await DeSports.resolveUnion(existing_union, 1, { from: existing_provider });
        await assertFail(async () => { await DeSports.claimBet(existing_union, { from: better }) });
      });

      it('a bet should return a predictable amount after a success', async function () {
        await DeSports.bet(existing_union, 0, 10, new BigNumber("20000000000"), { from: better });
        await DeSports.resolveUnion(existing_union, 0, { from: existing_provider });
        let { logs } = await DeSports.claimBet(existing_union, { from: better });
        let event = logs.find(e => e.event === 'BetClaim');
        expect(event).to.exist;
        assert.equal(event['args']['amount'].toNumber(), 20);
      });

      it('a bet should return a predictable amount after a success (bet on event 2)', async function () {
        await DeSports.bet(existing_union, 0, 5, new BigNumber("20000000000"), { from: better });
        // Lower the bet amount so that the deposit fund can secure the bet
        await DeSports.bet(existing_union, 1, 2, new BigNumber("20000000000"), { from: better2 });
        await DeSports.resolveUnion(existing_union, 1, { from: existing_provider });
        let { logs } =  await DeSports.claimBet(existing_union, { from: better2 });
        let event = logs.find(e => e.event === 'BetClaim');
        expect(event).to.exist;
        assert.equal(event['args']['amount'].toNumber(), 4);
      });
    });

    describe('lockable functions', async function () {
      beforeEach(async function () {
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
        const { logs } = await DeSports.setQuota(existing_union, 0, new BigNumber("10000000001"), { from: existing_provider });
        const event = logs.find(e => e.event === 'Quota');
        expect(event).to.exist;
      });

      it('setQuotas should be lockable', async function () {
        await assertFail(async () => { await DeSports.setQuotas(existing_union, [new BigNumber("10000000001"), new BigNumber("10000000002")], { from: existing_provider }) }, "Function should not be callable while locked");
        await DeSports.changeContractStatus(false);
        const { logs } = await DeSports.setQuotas(existing_union, [new BigNumber("10000000001"), new BigNumber("10000000002")], { from: existing_provider });
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

        it('bet should be lockable', async function () {
          // Unlock the contract to start betting or else bet will always fail
          await DeSports.changeContractStatus(false);
          await DeSports.startBetting(existing_union, { from: existing_provider });
          await DeSports.setQuota(existing_union, 0, new BigNumber("10000000001"), { from: existing_provider });
          await DeSports.changeContractStatus(true);
          await assertFail(async () => { await DeSports.bet(existing_union, 0, 10, new BigNumber("10000000001"), { from: better }) }, "Function should not be callable while locked");
          await DeSports.changeContractStatus(false);
          const { logs } = await DeSports.bet(existing_union, 0, 10, new BigNumber("10000000001"), { from: better });
          const event = logs.find(e => e.event === 'Bet');
          expect(event).to.exist;
        });
      });
    });
  });
});
