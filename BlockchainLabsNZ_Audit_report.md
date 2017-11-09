# MobileGo DeSports Audit Report

## Preamble
This audit report was undertaken by BlockchainLabs.nz for the purpose of providing feedback to MobileGo. It has subsequently been shared publicly without any express or implied warranty.

Solidity contracts were sourced from the MobileGo Team - we would encourage all community members and token holders to make their own assessment of the contracts.

## Scope
All Solidity code contained in the DeSports.sol contract file was considered in scope as a basis for static and dynamic analysis.

## Focus Areas
The audit report is focused on the following key areas - though this is not an exhaustive list.
### Correctness
- No correctness defects uncovered during static analysis?
- No implemented contract violations uncovered during execution?
- No other generic incorrect behaviour detected during execution?
- Adherence to adopted standards such as ERC20?
### Testability
- Test coverage across all functions and events?
- Test cases for both expected behaviour and failure modes?
- Settings for easy testing of a range of parameters?
- No reliance on nested callback functions or console logs?
- Avoidance of test scenarios calling other test scenarios?
### Security
- No presence of known security weaknesses?
- No funds at risk of malicious attempts to withdraw/transfer?
- No funds at risk of control fraud?
- Prevention of Integer Overflow or Underflow?
### Best Practice
- Explicit labeling for the visibility of functions and state variables?
- Proper management of gas limits and nested execution?
- Latest version of the Solidity compiler?

## Classification
### Defect Severity
- Minor - A defect that does not have a material impact on the contract execution and is likely to be subjective.
- Moderate - A defect that could impact the desired outcome of the contract execution in a specific scenario.
- Major - A defect that impacts the desired outcome of the contract execution or introduces a weakness that may be exploited.
- Critical - A defect that presents a significant security vulnerability or failure of the contract across a range of scenarios.

## Findings
### Minor
- **The `bet` function could use a variable to make it more readible** -  `preciselyMultiply(amount, preciseQuota);` is used multiple times in the `bet` function, it could aliased to something like `expectedReturn` to make the function easier to follow
  - [X] *Fixed*
- **Functions should throw an error instead of returning false** -  Functions should use `revert()` instead of return false to signal that the function can not complete. A big advantage of this tactic is that most wallet software will give you a warning that the transaction will not go through before you make the transaction.
  - [X] *Fixed*
- **Refactor in `claimBet` function readability** -
```
balances[msg.sender] -= preciselyMultiply(actions[msg.sender][unionName][unions[unionName].result],
        providers[unions[unionName].provider].preciseFee);
balances[unions[unionName].provider] += preciselyMultiply(actions[msg.sender][unionName][unions[unionName].result],
        providers[unions[unionName].provider].preciseFee);
```
could be refactored to:
```
uint fee = preciselyMultiply(actions[msg.sender][unionName][unions[unionName].result],
        providers[unions[unionName].provider].preciseFee);
balances[msg.sender] -= fee;
balances[unions[unionName].provider] += fee;
```
  - [X] *Fixed*

### Moderate
- **`setQuotas` doesn't require the quota to be higher than the precision amount** -  `setQuotas` function doesn't check to see if the new preciseQuota amount is higher than precision. The single version `setQuota` does this check
  - [X] *Fixed*

### Major
- None found

### Critical
- **providerFund and depositFund can underflow** -  Inside the bet function there are some checks:
```
// let's alias preciselyMultiply(amount, preciseQuota) for easier reading
uint expectedReturn = preciselyMultiply(amount, preciseQuota);
if (expectedReturn >= unions[unionName].providerFund) {
    unions[unionName].providerFund -= expectedReturn;
}
```
`providerFund` is a uint so it can't be a negative value, if `expectedReturn` is greater than the provider fund then it underflows to 2**256 - 1
You can reproduce this bug very easily by placing a bet on an event that is lower than the providerFund, the first bet will always be greater than the despositFund so it will underflow
  - [X] *Fixed*
- **`resolveUnion` doesn't set the result** - `resolveUnion` doesn't set the union result, the result will always be 0.
  - [X] *Fixed*


## Conclusion
Overall we have been satisfied with the resulting contracts following the audit feedback period. We took part in carefully reviewing all source code provided to fully satisfy test coverage in all areas, including deployment on the Kovan test network, and writing tests. We created tests for the contracts which cover 95.58% of the statements.

The developers have followed common best practices and demonstrated an awareness for compiling contracts in a modular format to avoid confusion and improve transparency.
