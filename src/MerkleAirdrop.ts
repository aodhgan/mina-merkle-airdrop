/*
Description: 
This example describes how developers can use Merkle Trees as a basic off-chain storage tool.
zkApps on Mina can only store a small amount of data on-chain, but many use cases require your application to at least reference big amounts of data.
Merkle Trees give developers the power of storing large amounts of data off-chain, but proving its integrity to the on-chain smart contract!
! Unfamiliar with Merkle Trees? No problem! Check out https://blog.ethereum.org/2015/11/15/merkling-in-ethereum/
*/

import {
  SmartContract,
  isReady,
  // shutdown,
  Poseidon,
  Field,
  Experimental,
  Permissions,
  DeployArgs,
  State,
  state,
  // Circuit,
  CircuitValue,
  PublicKey,
  UInt64,
  prop,
  method,
  UInt32,
} from 'snarkyjs';
// import { makeGuess } from './makeGuess';
// const makeGuess = require("./makeGuess");

let initialBalance = 10_000_000_000;

export class Account extends CircuitValue {
  @prop publicKey: PublicKey;
  @prop points: UInt32;

  constructor(publicKey: PublicKey, points: UInt32) {
    super(publicKey, points);
    this.publicKey = publicKey;
    this.points = points;
  }

  hash(): Field {
    return Poseidon.hash(this.toFields());
  }

  addPoints(n: number): Account {
    return new Account(this.publicKey, this.points.add(n));
  }
}

await isReady;

export class MerkleWitness extends Experimental.MerkleWitness(8) {}

// we need the initiate tree root in order to tell the contract about our off-chain storage
// let initialCommitment: Field = Field.fromString("14386905136047813188402530458040163982382296957159056735222247321988650670868");
/*
  We want to write a smart contract that serves as a leaderboard,
  but only has the commitment of the off-chain storage stored in an on-chain variable.
  The accounts of all participants will be stored off-chain!
  If a participant can guess the preimage of a hash, they will be granted one point :)
*/

export class MerkleAirdrop extends SmartContract {
  // a commitment is a cryptographic primitive that allows us to commit to data, with the ability to "reveal" it later
  @state(Field) commitment = State<Field>();

  deploy(args: DeployArgs) {
    super.deploy(args);
    this.setPermissions({
      ...Permissions.default(),
      editState: Permissions.proofOrSignature(),
    });
    this.balance.addInPlace(UInt64.fromNumber(initialBalance));
  }

  @method
  setPreImage(preImage: Field) {
    console.log(`contract setting preImage to `, preImage.toString());
    this.commitment.set(preImage);
  }

  @method
  guessPreimage(account: Account, path: MerkleWitness) {
    // we fetch the on-chain commitment
    let commitment = this.commitment.get();
    this.commitment.assertEquals(commitment);

    // we check that the account is within the committed Merkle Tree
    console.log('checking acccount is in tree');
    path.calculateRoot(account.hash()).assertEquals(commitment);
    console.log('acccount is in tree');

    // we update the account and grant one point!
    let newAccount = account.addPoints(1);

    // we calculate the new Merkle Root, based on the account changes
    let newCommitment = path.calculateRoot(newAccount.hash());

    this.commitment.set(newCommitment);
  }
}
