import { MerkleAirdrop, Account, MerkleWitness } from './MerkleAirdrop';
import {
  isReady,
  shutdown,
  Field,
  Mina,
  PrivateKey,
  PublicKey,
  AccountUpdate,
  UInt32,
  Experimental,
} from 'snarkyjs';

/*
 * This file specifies how to test the `Add` example smart contract. It is safe to delete this file and replace
 * with your own tests.
 *
 * See https://docs.minaprotocol.com/zkapps for more info.
 */

const Tree = new Experimental.MerkleTree(8);
let initialBalance = 10_000_000_000;
type Names = 'Bob' | 'Alice' | 'Charlie' | 'Olivia';
export let Accounts: Map<string, Account> = new Map<Names, Account>();

let alice, charlie, olivia: any;
let initialCommitment: any;

function createLocalBlockchain() {
  const Local = Mina.LocalBlockchain();
  Mina.setActiveInstance(Local);

  alice = new Account(Local.testAccounts[1].publicKey, UInt32.from(0));
  charlie = new Account(Local.testAccounts[2].publicKey, UInt32.from(0));
  olivia = new Account(Local.testAccounts[3].publicKey, UInt32.from(0));

  Accounts.set('Alice', alice);
  Accounts.set('Charlie', charlie);
  Accounts.set('Olivia', olivia);

  Tree.setLeaf(BigInt(0), alice.hash());
  Tree.setLeaf(BigInt(1), charlie.hash());
  Tree.setLeaf(BigInt(2), olivia.hash());

  initialCommitment = Tree.getRoot();

  return Local.testAccounts[0].privateKey;
}

async function localDeploy(
  zkAppInstance: MerkleAirdrop,
  zkAppPrivatekey: PrivateKey,
  deployerAccount: PrivateKey
) {
  const txn = await Mina.transaction(deployerAccount, () => {
    AccountUpdate.fundNewAccount(deployerAccount, { initialBalance });
    zkAppInstance.deploy({ zkappKey: zkAppPrivatekey });
    // zkAppInstance.init();
    // zkAppInstance.sign(zkAppPrivatekey);
  });
  await txn.send().wait();
}

describe('MerkleAirdrop', () => {
  let deployerAccount: PrivateKey,
    zkAppAddress: PublicKey,
    zkAppPrivateKey: PrivateKey;

  beforeEach(async () => {
    await isReady;
    deployerAccount = createLocalBlockchain();
    zkAppPrivateKey = PrivateKey.random();
    zkAppAddress = zkAppPrivateKey.toPublicKey();
  });

  afterAll(async () => {
    // `shutdown()` internally calls `process.exit()` which will exit the running Jest process early.
    // Specifying a timeout of 0 is a workaround to defer `shutdown()` until Jest is done running all tests.
    // This should be fixed with https://github.com/MinaProtocol/mina/issues/10943
    setTimeout(shutdown, 0);
  });

  it('generates and deploys the `MerkleAirdrop` smart contract', async () => {
    const zkAppInstance = new MerkleAirdrop(zkAppAddress);
    await localDeploy(zkAppInstance, zkAppPrivateKey, deployerAccount);
    console.log(`test one deployed!`);
    await setPreImage(deployerAccount, zkAppPrivateKey, zkAppInstance);
    // const num = zkAppInstance.num.get();
    // expect(num).toEqual(Field.one);
  });

  it('correctly updates the merkle root on the `MerkleAirdrop` smart contract', async () => {
    const zkAppInstance = new MerkleAirdrop(zkAppAddress);
    await localDeploy(zkAppInstance, zkAppPrivateKey, deployerAccount);
    console.log(`test two deployed!`);
    await setPreImage(deployerAccount, zkAppPrivateKey, zkAppInstance);
    makeGuess(
      'Alice',
      BigInt(0),
      22,
      deployerAccount,
      zkAppPrivateKey,
      zkAppInstance
    );
    console.log('guessed!');
  });
});

async function setPreImage(
  feePayer: any,
  zkappKey: any,
  leaderboardZkApp: MerkleAirdrop
) {
  let tx = await Mina.transaction(feePayer, () => {
    console.log('setting preimage to ...', initialCommitment.toString());
    leaderboardZkApp.setPreImage(initialCommitment);
    console.log('returned from setting preimage');
    leaderboardZkApp.sign(zkappKey);
  });
  await tx.prove();
  await tx.send();
}

async function makeGuess(
  name: Names,
  index: bigint,
  guess: number,
  feePayer: any,
  zkappKey: any,
  leaderboardZkApp: MerkleAirdrop
) {
  let account = Accounts.get(name)!;
  let w = Tree.getWitness(index);
  let witness = new MerkleWitness(w);

  let tx = await Mina.transaction(feePayer, () => {
    console.log('test guessing...');
    leaderboardZkApp.guessPreimage(Field(guess), account, witness);
    console.log('returned from guessing');
    leaderboardZkApp.sign(zkappKey);
  });

  await tx.prove();
  await tx.send();

  // if the transaction was successful, we can update our off-chain storage as well
  account.points = account.points.add(1);
  Tree.setLeaf(index, account.hash());
  console.log(
    'leaderboardZkApp.commitment.get()',
    leaderboardZkApp.commitment.get()
  );
  leaderboardZkApp.commitment.get().assertEquals(Tree.getRoot());
}
