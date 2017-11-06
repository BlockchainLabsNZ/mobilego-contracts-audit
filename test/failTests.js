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
    await DeSports.wavesTokenFallback(provider, 100000000000);
    await DeSports.wavesTokenFallback(existing_provider, 100000000000);
    await DeSports.wavesTokenFallback(better, 10000000000);
  });

  it('setFee should not be changed if higher than maxProvidersFee ', async function () {
    
    let { logs } = await DeSports.setFee(1000000001, { from: provider }); 
    let event = logs.find(e => e.event === 'Fee');
    expect(event).to.not.exist;
  });

  it('providers cannot fundUnion with more tokens than they own', async function () {
    await DeSports.createUnion(0x0, { from: provider });
    let { logs } = await DeSports.fundUnion(0x0, 100000000001, { from: provider }); 
    let event = logs.find(e => e.event === 'UnionFunding');
    expect(event).to.not.exist;
  });   

  it('createEvent should not initiate an event', async function () {
    await DeSports.createUnion(0x0, { from: provider });
    await DeSports.startBetting(0x0, { from: provider });
    let { logs } = await DeSports.createEvent(0x01, 0x0, { from: provider });  
    let event = logs.find(e => e.event === 'EventCreation');
    expect(event).to.not.exist;
  });

  it('startBetting should not initiate betting', async function () {
    await DeSports.createUnion(0x0, { from: provider });
    await DeSports.startBetting(0x0, { from: provider });
    let { logs } = await DeSports.startBetting(0x0, { from: provider });  
    let event = logs.find(e => e.event === 'BettingStarted');
    expect(event).to.not.exist;
  });
});