'use strict';
var DeSportsArtifact = artifacts.require('DeSports.sol');

const assertFail = require("./helpers/assertFail");
const BigNumber = require("bignumber.js");
require('chai')
  .use(require('chai-as-promised'))
  .use(require('chai-bignumber')(BigNumber))
  .should()
const expect = require('chai').expect

contract('Feature Tests', async function ([owner, better, provider, existing_provider, vandal]) {
  let DeSports;
  const test_union = web3.fromAscii("Test Union");
  const test_event = web3.fromAscii("Test Event");

  beforeEach(async function () {
    DeSports = await DeSportsArtifact.new();
    // Send 9000 tokens to providers for testing
    await DeSports.wavesTokenFallback(provider, 100000000000);
    await DeSports.wavesTokenFallback(existing_provider, 100000000000);
    await DeSports.wavesTokenFallback(better, 10000000000);
  });

// END TO END TESTS

  it('as a provider I should be able to create events that users can bet on', async function () {
    await DeSports.createUnion(0x0, { from: provider });
    await DeSports.fundUnion(0x0, 12300000000, { from: provider });
    await DeSports.createEvent(0x01, 0x0, { from: provider });
    await DeSports.setQuota(0x0, 0, 10000000001, { from: provider });
    await DeSports.startBetting(0x0, { from: provider });
    const { logs } = await DeSports.bet(0x0, 0, 1000000000, new BigNumber("10000000001"), { from: better });
    const event = logs.find(e => e.event === 'Bet');
    expect(event).to.exist;
  });

  it('as a provider I should be able to build a reputation', async function () {
    await DeSports.createUnion(0x0, { from: provider });
    await DeSports.fundUnion(0x0, 12300000000, { from: provider });
    await DeSports.createEvent(0x01, 0x0, { from: provider });
    await DeSports.setQuota(0x0, 0, 10000000001, { from: provider });
    await DeSports.startBetting(0x0, { from: provider });
    const { logs } = await DeSports.bet(0x0, 0, 1000000000, new BigNumber("10000000001"), { from: better });
    const event = logs.find(e => e.event === 'Bet');
    await DeSports.resolveUnion(0x0, 0, { from: provider });
    let reputation_increment = await DeSports.providers(provider);
    assert.equal(reputation_increment[1].toNumber(), 1000000000);
  });

  it('as a user I should be able to claim bet after being resolved', async function () {
    assert.equal((await DeSports.balances(better)).toNumber(), 10000000000);
    await DeSports.createUnion(0x0, { from: provider });
    await DeSports.fundUnion(0x0, 12300000000, { from: provider });
    await DeSports.createEvent(0x01, 0x0, { from: provider });
    await DeSports.setQuota(0x0, 0, 20000000000, { from: provider });
    await DeSports.startBetting(0x0, { from: provider });
    const { logs } = await DeSports.bet(0x0, 0, 10000000000, new BigNumber("20000000000"), { from: better });
    await DeSports.resolveUnion(0x0, 0, { from: provider });
    await DeSports.claimBet(0x0, { from: better });
    assert.equal((await DeSports.balances(better)).toNumber(), 20000000000);
  });
});
