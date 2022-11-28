import { MerkleAirdrop, Account, MerkleWitnessC } from './MerkleAirdrop';
import {
  isReady,
  shutdown,
  Mina,
  PrivateKey,
  PublicKey,
  AccountUpdate,
  UInt32,
  // Experimental,
  MerkleTree,
  UInt64,
  Sign,
  Signature
} from 'snarkyjs';


const Tree = new MerkleTree(8);
const initialTokens = 100;
let initialBalance = 10_000_000_000;
type Names = 'Bob' | 'Alice' | 'Charlie' | 'Olivia';
export let Accounts: Map<string, Account> = new Map<Names, Account>();

let alice, charlie, olivia: any;
let initialCommitment: any;

let verificationKey: any;




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
  // ({ verificationKey } = await MerkleAirdrop.compile());

  const txn = await Mina.transaction(deployerAccount, () => {
    AccountUpdate.fundNewAccount(deployerAccount, { initialBalance });
    zkAppInstance.deploy({ zkappKey: zkAppPrivatekey });
    // zkAppInstance.init();
    // zkAppInstance.sign(zkAppPrivatekey);
  });
  await txn.send()
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

  it('deploys the `MerkleAirdrop` smart contract and setsPreImage', async () => {
    const zkAppInstance = new MerkleAirdrop(zkAppAddress);
    await localDeploy(zkAppInstance, zkAppPrivateKey, deployerAccount);
    await setCommitment(deployerAccount, zkAppPrivateKey, zkAppInstance);

    expect(zkAppInstance.commitment.get()).toEqual(initialCommitment);
  });

  it('correctly updates the merkle root on the `MerkleAirdrop` smart contract', async () => {
    const zkAppInstance = new MerkleAirdrop(zkAppAddress);
    await localDeploy(zkAppInstance, zkAppPrivateKey, deployerAccount);
    await setCommitment(deployerAccount, zkAppPrivateKey, zkAppInstance);

    makeGuess(
      'Alice',
      BigInt(0),
      deployerAccount,
      zkAppPrivateKey,
      zkAppInstance
    );
  });

  it('check Alice is in the set', async () => {
    const zkAppInstance = new MerkleAirdrop(zkAppAddress);
    await localDeploy(zkAppInstance, zkAppPrivateKey, deployerAccount);
    await setCommitment(deployerAccount, zkAppPrivateKey, zkAppInstance);

    await checkInclusion(
      'Alice',
      BigInt(0),
      deployerAccount,
      zkAppPrivateKey,
      zkAppInstance
    );
  });

  it('can mint', async () => {
    const zkAppInstance = new MerkleAirdrop(zkAppAddress);
    await localDeploy(zkAppInstance, zkAppPrivateKey, deployerAccount);
    await setCommitment(deployerAccount, zkAppPrivateKey, zkAppInstance);

    console.log("minting...")
    await mint(deployerAccount,
      zkAppPrivateKey,
      zkAppInstance)
    console.log("minted")
  });


  it('can claim', async () => {
    const zkAppInstance = new MerkleAirdrop(zkAppAddress);
    await localDeploy(zkAppInstance, zkAppPrivateKey, deployerAccount);
    await setCommitment(deployerAccount, zkAppPrivateKey, zkAppInstance);

    await claim('Alice',
      BigInt(0),
      deployerAccount,
      zkAppPrivateKey,
      zkAppInstance)
  });

  it('throws when randomer is not in set', async () => {
    const zkAppInstance = new MerkleAirdrop(zkAppAddress);
    await localDeploy(zkAppInstance, zkAppPrivateKey, deployerAccount);
    await setCommitment(deployerAccount, zkAppPrivateKey, zkAppInstance);
    try {
      expect(
        await checkInclusion(
          'Bob',
          BigInt(0),
          deployerAccount,
          zkAppPrivateKey,
          zkAppInstance
        )
      ).toThrow();
    } catch (e) {
      console.log(e);
    }
  });
});

async function setCommitment(
  feePayer: any,
  zkappKey: any,
  merkleZkApp: MerkleAirdrop
) {
  let tx = await Mina.transaction(feePayer, () => {
    console.log('setting preimage to ...', initialCommitment.toString());
    merkleZkApp.setCommitment(initialCommitment);
    console.log('returned from setting preimage');
    merkleZkApp.sign(zkappKey);
  });
  await tx.prove();
  await tx.send();
}

async function checkInclusion(
  name: Names,
  index: bigint, // do we need index? can we just loop in the tree?
  feePayer: any,
  zkappKey: any,
  leaderboardZkApp: MerkleAirdrop
) {
  let tx = await Mina.transaction(feePayer, () => {
    let account = Accounts.get(name)!;
    let w = Tree.getWitness(index);
    let witness = new MerkleWitnessC(w);
    leaderboardZkApp.checkInclusion(account, witness);
    leaderboardZkApp.sign(zkappKey);
  });
  await tx.prove();
  await tx.send();
}

async function claim(
  name: Names,
  index: bigint, // do we need index? can we just loop in the tree?
  feePayer: any,
  zkappKey: any,
  leaderboardZkApp: MerkleAirdrop
) {
  let tx = await Mina.transaction(feePayer, () => {
    let account = Accounts.get(name)!;
    let w = Tree.getWitness(index);
    let witness = new MerkleWitnessC(w);
    leaderboardZkApp.claim(account, witness);
    leaderboardZkApp.sign(zkappKey);
  });
  await tx.prove();
  await tx.send();
}

async function mint(
  feePayer: any,
  zkappKey: any,
  leaderboardZkApp: MerkleAirdrop
) {
  const sig = Signature.create(zkappKey, (UInt64.from(initialTokens)).toFields().concat(leaderboardZkApp.address.toFields()))
  console.log({ sig })

  let tx = await Mina.transaction(feePayer, () => {
    // AccountUpdate.fundNewAccount(feePayer);
    leaderboardZkApp.mint(leaderboardZkApp.address, UInt64.from(initialTokens), sig);
    leaderboardZkApp.sign(zkappKey);
  });
  // await tx.prove();
  // tx.sign([zkappKey])
  await tx.send();
}

async function makeGuess(
  name: Names,
  index: bigint,
  feePayer: any,
  zkappKey: any,
  merkleAirdropZkApp: MerkleAirdrop
) {
  let account = Accounts.get(name)!;
  let w = Tree.getWitness(index);
  let witness = new MerkleWitnessC(w);

  let tx = await Mina.transaction(feePayer, () => {
    console.log('test guessing...');
    merkleAirdropZkApp.guessPreimage(account, witness);
    console.log('returned from guessing');
    merkleAirdropZkApp.sign(zkappKey);
  });

  await tx.prove();
  await tx.send();

  // if the transaction was successful, we can update our off-chain storage as well
  account.points = account.points.add(1);
  Tree.setLeaf(index, account.hash());
  console.log(
    'leaderboardZkApp.commitment.get()',
    merkleAirdropZkApp.commitment.get()
  );
  merkleAirdropZkApp.commitment.get().assertEquals(Tree.getRoot());
}
