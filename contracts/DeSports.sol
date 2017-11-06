pragma solidity ^0.4.17;

/*
--------------------------------------------------------------------------------
Decentralized eSports [DeSports] Betting Platform Smart Contract

Credit:
Stefan Crnojević scrnojevic@protonmail.ch
MobileGo Inc, GameCredits Inc

MIT License
--------------------------------------------------------------------------------
*/

/**
 * @title [Contract] Precise Math Library (PreciseMath)
 * @dev Makes percentage calculations possible in Solidity.
 * They preserve the decimal information, but at the expense of scope,
 * thus minDeposit and maxDeposit are introduced.
 * @notice Use these functions instead of '*' and '/'.
 * @notice Prefix with 'precise' any variables multiplied by the variable 'precise'.
 */

contract PreciseMath {

    /* Desired number of decimal places. */
    uint8 constant public decimalPrecision = 10;

    /* Auxiliary variable to avoid recomputation */
    uint constant public precision = 10000000000;               // = 1.0000000000 (precise format)
                      // precision = 10 ** decimalPrecision;    // = 1.0000000000 (precise format)

    /* Replacement for / (division) */
    function preciselyDivide(uint numerator, uint denominator) internal constant returns (uint preciseQuotient) {
        return numerator * precision / denominator;
    }

    /* Replacement for * (multiplication) */
    function preciselyMultiply(uint multiplier, uint preciseQuotient) internal constant returns (uint preciseProduct) {
        return preciseQuotient * multiplier / precision;
    }
}

/**
 * @title [Contract] KillSwitch
 * @dev Allows the contract to be locked in a state of emergency.
 * @dev Use by addding the modifier 'lockable' to any desired function signature.
 */

contract KillSwitch {

    bool public contractLocked;
    address public owner;

    modifier lockable {
        require(!contractLocked);
        _;
    }

    /* A modifier that excludes the execution of a function to a single address. */
    modifier only(address exclusiveAddress) {
        require(msg.sender == exclusiveAddress);
        _;
    }

    /* Locks / unlocks the contract. */
    event ContractStatusChange(bool newStatus);
    function changeContractStatus(bool newStatus) external only(owner) returns (bool success) {
        contractLocked = newStatus;
        ContractStatusChange(newStatus);
        return true;
    }

}

/**
 * @title [Interface] Ethereum-based MobileGo Token
 */

contract MobileGoToken {
    function transfer(address _to, uint _value) returns (bool success);
}

/**
 * @title [Contract] Decentralized eSports (DeSports)
 * @dev Creates a free market for an ecosystem of betters and bet providers.
 * Anyone can provide a match that people can bet on
 * and build their reputation and income on being an honest party.
 * Anyone can bet on any of the provided matches with the dual MobileGo token.
 * @notice Make sure to also deploy the MGO Token Contract while testing.
 * @notice Make sure to insert the address of that contract to 'mgoAddress'.
 * @notice Quota, for simplicity, is the exact multiplier in case of a win.
 */

contract DeSports is KillSwitch, PreciseMath {

    struct wavesAddress {
        bytes32 addressStart;
        // A Waves address has 33 non-deterministic characters, adding another character to track.
        byte lastCharacter;
    }

    struct withdrawal {
        address requester;
        uint amount;
    }

    struct historyLog {
        bytes32 unionName;
        uint8 eventIndex;
        uint amount;
        uint preciseMomentaryQuota;
    }

    struct withdrawalRequest {
        bool ethereum;
        uint amount;
    }

    struct _provider {
        uint preciseFee;
        uint reputation;
    }

    struct _event {
        bytes32 name;
        uint preciseQuota;
        /* The amount of MGO to be paid if the event occurs. */
        uint totalClaim;
    }

    struct union {
        address provider;
        /* The pools of MGO that back the bets. */
        uint providerFund;
        uint depositFund;
        /* The same pools that are not subtracted from during betting. */
        uint originalProviderFund;
        uint originalDepositFund;
        /* The possible states of the union. */
        bool bettingStarted;
        bool bettingLocked;
        bool resolved;
        /* A set of mutually exclusive events. */
        mapping(uint8 => _event) events;
        uint8 eventCount;
        uint8 result;
    }

    /*
        `mgoAddress` is not constant because of the warning for breaking changes
        regarding initial values that are not compile-time constants.
    */
    address public mgoAddress = 0x40395044Ac3c0C57051906dA938B54BD6557F212;

    /* Betting-related variables. */
    mapping(address => _provider) public providers;
    mapping(bytes32 => union) public unions;
    mapping(address => mapping(uint => historyLog)) public bettingHistory;
    mapping(address => uint) public betCount;
    mapping(address => mapping(bytes32 => mapping(uint8 => uint))) public actions;
    mapping(address => mapping(uint8 => bytes32)) public ip_ports;

    /* MGO-related variables.  */
    mapping(address => withdrawalRequest) public withdrawalRequests;
    mapping(address => uint) public balances;
    mapping(address => wavesAddress) public wavesAddresses;

    /* Fee-related variables. */
    uint40 public preciseWithdrawalFee = 100000000;             //  1%    (precise)
    uint40 constant public preciseMaxProviderFee = 1000000000;  //  10%   (precise)

    /* Constructor funciton. */
    function DeSports() {
        /* The official GameCredits / MobileGo Inc. address. */
        owner = msg.sender;
    }

    /** Owner functions. **/

    /* Change the withdrawal fee for MGO withdrawal on Ethereum or Waves. */
    event WithdrawalFeeChange(uint40 preciseNewFee);
    function changeWithdrawalFee(uint40 preciseNewFee) external only(owner) returns (bool success) {
        preciseWithdrawalFee = preciseNewFee;
        WithdrawalFeeChange(preciseNewFee);
        return true;
    }

    /* Confirm that the withdrawal of WavesMGO has ocurred on the Waves blockchain. */
    event WithdrawalConfirmation(address requester, bool ethereum, uint amount);
    function confirmWithdrawal(address requester) external only(owner) returns (bool success) {
        if (withdrawalRequests[requester].ethereum) {
            MobileGoToken mgo = MobileGoToken(mgoAddress);
            mgo.transfer(requester, withdrawalRequests[requester].amount);
        }
        WithdrawalConfirmation(requester, withdrawalRequests[requester].ethereum, withdrawalRequests[requester].amount);
        withdrawalRequests[requester].amount = 0;
        return true;
    }

    /* A fallback function for the wavesMGO deposit. */
    event WavesDeposit(address _from, uint _value);
    function wavesTokenFallback(address _from, uint _value) external lockable only(owner) returns (bool success) {
        require(_value > 0);
        balances[_from] += _value;
        WavesDeposit(_from, _value);
        return true;
    }

    /** Provider/Resolver functions. **/

    /* A provider announces the IP where they can be pinged. */
    event IP_Port(address provider, uint8 index, bytes32 ip_port);
    function setIP_Port(uint8 index, bytes32 ip_port) external returns (bool success) {
        ip_ports[msg.sender][index] = ip_port;
        IP_Port(msg.sender, index, ip_port);
        return true;
    }

    /* A provider changes the fee that they accept for honest match resolutions. */
    event Fee(address provider, uint40 preciseNewFee);
    function setFee(uint40 preciseNewFee) external lockable returns (bool success) {
        if (preciseNewFee <= preciseMaxProviderFee) {
            providers[msg.sender].preciseFee = preciseNewFee;
            Fee(msg.sender, preciseNewFee);
            return true;
        } else {
            return false;
        }
    }

    /* Create a union of mutually exclusive bettable events that have dependent investment pools. */
    event UnionCreation(bytes32 unionName, address provider);
    function createUnion(bytes32 unionName) external lockable returns (bool success) {
        if (unions[unionName].provider == 0x0) {
            unions[unionName].provider = msg.sender;
            UnionCreation(unionName, msg.sender);
            return true;
        } else {
            return false;
        }
    }

    /* The provider guarantees for the quota fulfillment by backing it up with funds. */
    event UnionFunding(bytes32 unionName, uint amount);
    function fundUnion(bytes32 unionName, uint amount) external lockable only(unions[unionName].provider) returns (bool success) {
        if (balances[msg.sender] >= amount) {
            unions[unionName].providerFund += amount;
            unions[unionName].originalProviderFund += amount;
            balances[msg.sender] -= amount;
            UnionFunding(unionName, amount);
            return true;
        } else {
            return false;
        }
    }

    /* Create an event whose outcome the users can bet on. */
    event EventCreation(bytes32 eventName, bytes32 unionName, address provider);
    function createEvent(bytes32 eventName, bytes32 unionName) external lockable only(unions[unionName].provider) returns (bool success) {
        if (!unions[unionName].bettingStarted) {
            unions[unionName].events[unions[unionName].eventCount].name = eventName;
            unions[unionName].eventCount++;
            EventCreation(eventName, unionName, msg.sender);
            return true;
        } else {
            return false;
        }
    }

    /* Starts betting on a union of an events, in turn locking the events in place. */
    event BettingStarted(bytes32 unionName);
    function startBetting(bytes32 unionName) external lockable only(unions[unionName].provider) returns (bool success) {
        if (!unions[unionName].bettingStarted) {
            unions[unionName].bettingStarted = true;
            BettingStarted(unionName);
            return true;
        } else {
            return false;
        }
    }

    /* The provider sets the quota for one event. */
    event Quota(bytes32 unionName, uint8 eventIndex, uint preciseQuota);
    function setQuota(bytes32 unionName, uint8 eventIndex, uint preciseQuota) external lockable only(unions[unionName].provider) returns (bool success) {
        if (preciseQuota > precision    &&  // preciseQuota > 1.0000000000 (precise format)
            !unions[unionName].resolved) {
            unions[unionName].events[eventIndex].preciseQuota = preciseQuota;
            Quota(unionName, eventIndex, preciseQuota);
            return true;
        } else {
            return false;
        }
    }

    /* The provider sets the quotas for all events in a union. May be preferred to the previous function because of atomicity. */
    event Quotas(bytes32 unionName);
    function setQuotas(bytes32 unionName, uint[] preciseQuotas) external lockable only(unions[unionName].provider) returns (bool success) {
        if (!unions[unionName].resolved     &&
            preciseQuotas.length == unions[unionName].eventCount) {
            for (uint8 i = 0; i < preciseQuotas.length; i++) {
                if (preciseQuotas[i] > precision) {     // preciseQuotas[i] > 1.0000000000 (precise format)
                    unions[unionName].events[i].preciseQuota = preciseQuotas[i];
                } else {
                    revert();
                }
            }
            Quotas(unionName);
            return true;
        } else {
            return false;
        }
    }

    /* Lock / Unlock betting at any certain period of time. */
    event BettingLock(bytes32 unionName, bool newStatus);
    function lockBetting(bytes32 unionName, bool newStatus) external lockable only(unions[unionName].provider) returns (bool success) {
        unions[unionName].bettingLocked = newStatus;
        BettingLock(unionName, newStatus);
        return true;
    }

    /* The provider announces the outcome of the event (allowed only once). */
    event UnionResolution(bytes32 unionName, uint8 result);
    function resolveUnion(bytes32 unionName, uint8 result) external lockable only(unions[unionName].provider) returns (bool success) {
        if (!unions[unionName].resolved     &&
            result < unions[unionName].eventCount) {
            providers[msg.sender].reputation += unions[unionName].originalDepositFund;
            balances[msg.sender] += unions[unionName].originalDepositFund + unions[unionName].originalProviderFund
                                    - unions[unionName].events[result].totalClaim;
            unions[unionName].result = result;
            unions[unionName].resolved = true;
            UnionResolution(unionName, result);
            return true;
        } else {
            return false;
        }
    }

    /** User functions. **/

    /*
        Associate your Ethereum address with a Waves address.
        @notice Do this before each deposit and only with a new and unused address.
    */
    event AddressesAssociation(address ethereumAddress, bytes32 wavesAddressStart, byte wavesAddressEnd);
    function associateAddresses(bytes32 wavesAddressStart, byte wavesAddressEnd) external lockable returns (bool success) {
        wavesAddresses[msg.sender] = wavesAddress(wavesAddressStart, wavesAddressEnd);
        AddressesAssociation(msg.sender, wavesAddressStart, wavesAddressEnd);
        return true;
    }

    /* Implements Ethereum MGO ERC223 token fallback function as deposit. */
    event EthereumDeposit(address _from, uint _value);
    function tokenFallback(address _from, uint _value, bytes _data) lockable {
        require(!contractLocked &&
                msg.sender == mgoAddress);
        balances[_from] += _value;
        EthereumDeposit(_from, _value);
        // _data; // ugly warning fix
    }

    /* Use your funds on the platform to bet that an event will occur. */
    // @param preciseCheckQuota security
    event Bet(bytes32 unionName, uint8 eventIndex, uint amount, uint preciseQuota, address better);
    function bet(bytes32 unionName, uint8 eventIndex, uint amount, uint preciseQuota) external lockable returns (bool success) {
        if (unions[unionName].bettingStarted    &&
            !unions[unionName].bettingLocked    &&
            !unions[unionName].resolved         &&
            balances[msg.sender] >= amount      &&
            amount > 0                          &&
            /* Security against a quota change transaction being confirmed before this one. */
            preciseQuota == unions[unionName].events[eventIndex].preciseQuota) {
            unions[unionName].depositFund += amount;
            /* Secure that the bet is backed by a fund. Efficient implementation. */
            if (preciselyMultiply(amount, preciseQuota) <= unions[unionName].providerFund) {
                unions[unionName].providerFund -= preciselyMultiply(amount, preciseQuota);
            } else if (preciselyMultiply(amount, preciseQuota) <= unions[unionName].depositFund) {
                unions[unionName].depositFund -= preciselyMultiply(amount, preciseQuota);
            } else if (preciselyMultiply(amount, preciseQuota) <= unions[unionName].depositFund + unions[unionName].providerFund) {
                unions[unionName].depositFund -= preciselyMultiply(amount, preciseQuota) - unions[unionName].providerFund;
                unions[unionName].providerFund = 0;
            } else {
                revert();
            }
            balances[msg.sender] -= amount;
            unions[unionName].originalDepositFund += amount;
            /* Update user's claims & investments. */
            actions[msg.sender][unionName][eventIndex] += preciselyMultiply(amount, preciseQuota);
            /* Record user's history. */
            bettingHistory[msg.sender][betCount[msg.sender]] = historyLog(unionName, eventIndex, preciselyMultiply(amount, preciseQuota), preciseQuota);
            betCount[msg.sender]++;
            /* Update the event pool's claims & investments. */
            unions[unionName].events[eventIndex].totalClaim += preciselyMultiply(amount, preciseQuota);
            Bet(unionName, eventIndex, preciselyMultiply(amount, preciseQuota), preciseQuota, msg.sender);
            return true;
        } else {
            return false;
        }
    }

    /* Claim the money from a bet. */
    event BetClaim(bytes32 unionName, uint amount, address claimer);
    function claimBet(bytes32 unionName) external returns (bool success) {
        if (unions[unionName].resolved  &&
            actions[msg.sender][unionName][unions[unionName].result] > 0) {
            balances[msg.sender] += actions[msg.sender][unionName][unions[unionName].result];
            balances[msg.sender] -= preciselyMultiply(actions[msg.sender][unionName][unions[unionName].result],
                                    providers[unions[unionName].provider].preciseFee);
            balances[unions[unionName].provider] += preciselyMultiply(actions[msg.sender][unionName][unions[unionName].result],
                                                    providers[unions[unionName].provider].preciseFee);
            BetClaim(unionName, actions[msg.sender][unionName][unions[unionName].result], msg.sender);
            actions[msg.sender][unionName][unions[unionName].result] = 0;
            return true;
        } else {
            return false;
        }
    }

    /* Withdraw an amount of Waves to an internal account or an external address. */
    event WithdrawalRequest(address requester, uint amount, bool ethereum);
    function requestWithdrawal(uint amount, bool ethereum) external returns (bool success) {
        if (balances[msg.sender] >= amount                  &&
            (ethereum                                       ||
            (wavesAddresses[msg.sender].addressStart != 0x0 &&
            wavesAddresses[msg.sender].lastCharacter != 0x0))) {
            balances[msg.sender] -= amount;
            balances[owner] += preciselyMultiply(amount, preciseWithdrawalFee);
            withdrawalRequests[msg.sender] = withdrawalRequest(ethereum, amount - preciselyMultiply(amount, preciseWithdrawalFee));
            WithdrawalRequest(msg.sender, amount, ethereum);
            return true;
        } else {
            return false;
        }
    }

    /** Other functions. **/

    /* Fetch the result of a mapping inside a struct (not provided by default). */
    function events(bytes32 unionName, uint8 eventIndex) external constant returns (bytes32, uint, uint) {
        return (unions[unionName].events[eventIndex].name, unions[unionName].events[eventIndex].preciseQuota,
                unions[unionName].events[eventIndex].totalClaim);
    }

    /* Prevents the (accidental) sending of ether to this contract. */
    function () {
        revert();
    }

}
