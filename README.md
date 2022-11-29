[![CI](https://github.com/aodhgan/mina-merkle-airdrop/actions/workflows/ci.yml/badge.svg)](https://github.com/aodhgan/mina-merkle-airdrop/actions/workflows/ci.yml)

# Merkle Airdrop
This is an implementation of a private Merkle Tree based airdrop built using Mina smart contracts and [snarkyJS](https://www.npmjs.com/package/snarkyjs), intended to have similar functionality to the popular [a16z repo](https://github.com/a16z/zkp-merkle-airdrop-contracts).

Without revealing their address (public key), a user can claim their airdrop. 
The presence of [MerkleMap](https://docs.minaprotocol.com/zkapps/tutorials/common-types-and-functions#merkle-map) based nullifiers prevent double-claiming. 

The zk-contract is also a [custom token](https://docs.minaprotocol.com/zkapps/advanced-snarkyjs/custom-tokens) by way of inheritance. 

## User Functionality
Once the contract is deployed the following functionality is exposed:
### Check Inclusion of account in Merkle tree dataset
```js
checkSetInclusion(account: Account, path: MerkleWitnessInstance)
```
where:\
`account` is the account you want to check \
`path` is the merkle tree path and is generated off-chain 

This method will throw if the account is not included in the airdrop data set. 


### Check if account has already claimed
```js
checkClaimed(account: Account, path: MerkleMapWitness): bigint
```
where: \
`account` is the account you want to check \
`path` is the merkle map witness and is generated off-chain

This method will return 1 if already claimed, 0 otherwise. 

### Claim
```js
  claim(
    account: Account,
    path: MerkleWitnessInstance,
    signature: Signature,
    mmWitness: MerkleMapWitness
  )
```
where:

`account` is the account you want to check \
`path` is the merkle tree path and is generated off-chain \
`signature` is an `account` private key signed permission slip to claim \
`mmWitness` is a Merkle Map witness to correctly prove the airdrop has not already been claimed

## Admin Functionality
### Mint tokens

```js
mint(
    receiverAddress: PublicKey,
    amount: UInt64,
    adminSignature: Signature
  )
```
where: \
`receiverAddress` is receiving address \
`amount` is the amount of tokens to mint \
`adminSignature` is the admin private key signed permission slip 


### Set Merkle Root commitment
```js
setCommitment(preImage: Field)
```
where: \
`preImage` is the merkle root of the data set of addresses that are eligible



# Installation
## Prerequisites
### Clone this repo
```sh
git clone git@github.com:aodhgan/mina-merkle-airdrop.git
```
and `cd` into `mina-merkle-airdrop`

### Use correct NodeJs version
```sh
nvm use
```

or manually install NodeJs `v18.8.0`

## How to build
**Note: these commands do not work with `yarn`**


```sh
npm run build
```

## How to run tests

```sh
npm run test
```
# Disclaimer
These smart contracts are being provided as is. No guarantee, representation or warranty is being made, express or implied, as to the safety or correctness of the user interface or the smart contracts. They have not been audited and as such there can be no assurance they will work as intended, and users may experience delays, failures, errors, omissions or loss of transmitted information. In addition, any airdrop using these smart contracts should be conducted in accordance with applicable law. Nothing in this repo should be construed as investment advice or legal advice for any particular facts or circumstances and is not meant to replace competent counsel. It is strongly advised for you to contact a reputable attorney in your jurisdiction for any questions or concerns with respect thereto. Developer is not liable for any use of the foregoing, and users should proceed with caution and use at their own risk.