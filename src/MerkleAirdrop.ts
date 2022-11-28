import {
  SmartContract,
  isReady,
  Poseidon,
  Field,
  Experimental,
  Permissions,
  DeployArgs,
  State,
  state,
  CircuitValue,
  PublicKey,
  UInt64,
  prop,
  method,
  UInt32,
  MerkleWitness,
  MerkleTree,
  Signature
} from 'snarkyjs';


let initialBalance = 10_000_000_000;
const tokenSymbol = 'MYTKN';

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

export class MerkleWitnessC extends MerkleWitness(8) { }

export class MerkleAirdrop extends SmartContract {
  // commitment is the root of the Merkle Tree
  @state(Field) commitment = State<Field>();

  // nullifiers are used to prevent double spending
  @state(Field) nullifiers = State<string>();

  // total supply of tokens
  @state(UInt64) totalAmountInCirculation = State<UInt64>();

  deploy(args: DeployArgs) {
    super.deploy(args);
    this.setPermissions({
      ...Permissions.default(),
      editState: Permissions.proofOrSignature(),
    });
    this.balance.addInPlace(UInt64.from(initialBalance));
    this.tokenSymbol.set(tokenSymbol);
    this.totalAmountInCirculation.set(UInt64.zero);
  }

  // @method init() {
  //   super.init();
  //   this.tokenSymbol.set(tokenSymbol);
  //   this.totalAmountInCirculation.set(UInt64.zero);
  // }

  // token method
  @method mint(
    receiverAddress: PublicKey,
    amount: UInt64,
    adminSignature: Signature
  ) {
    let totalAmountInCirculation = this.totalAmountInCirculation.get();
    this.totalAmountInCirculation.assertEquals(totalAmountInCirculation);
    console.log("contract:: minting", amount.toString(), "to", receiverAddress.toString());
    let newTotalAmountInCirculation = totalAmountInCirculation.add(amount);

    adminSignature
      .verify(
        this.address,
        amount.toFields().concat(receiverAddress.toFields())
      )
      .assertTrue();
    console.log("contract:: signature verified");

    // this.token.mint({
    //   address: receiverAddress,
    //   amount,
    // });
    console.log("updating totalAmountInCirculation");
    this.totalAmountInCirculation.set(newTotalAmountInCirculation);
    console.log("updated totalAmountInCirculation");
  }

  // token method
  @method sendTokens(
    senderAddress: PublicKey,
    receiverAddress: PublicKey,
    amount: UInt64
  ) {
    this.token.send({
      from: senderAddress,
      to: receiverAddress,
      amount,
    });
  }

  // set initial merkle tree value
  @method
  setCommitment(preImage: Field) {
    console.log(`contract setting preImage to `, preImage.toString());
    this.commitment.set(preImage);
  }

  @method
  guessPreimage(account: Account, path: MerkleWitnessC) {
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

  @method
  checkInclusion(account: Account, path: MerkleWitnessC) {
    // console.log('checkInclusion::checking inclusion for account', account.publicKey.toString());

    // we fetch the on-chain commitment
    let commitment = this.commitment.get();
    this.commitment.assertEquals(commitment);

    // we check that the account is within the committed Merkle Tree
    // console.log('checking acccount is in tree');
    path.calculateRoot(account.hash()).assertEquals(commitment);
  }

  @method
  claim(account: Account, path: MerkleWitnessC) {
    // console.log('claim::checking inclusion for account', account.publicKey.toString());

    // we fetch the on-chain commitment
    let commitment = this.commitment.get();
    this.commitment.assertEquals(commitment);

    // we check that the account is within the committed Merkle Tree
    // console.log('checking acccount is in tree');
    path.calculateRoot(account.hash()).assertEquals(commitment);

    // ensure this account has not been claimed before
    let nullifiers = this.nullifiers.get();
    this.nullifiers.assertEquals(nullifiers);
    console.log("claim::nullifiers.value", (nullifiers as any).value);
    // const nulls = new Uint8Array(Buffer.from(nullifiers.valueOf()));
    // console.log("claim::nulls", nulls);


    // now send value to the account
    // this.sendTokens(this.address, account.publicKey, UInt64.one);
    // this.mint(account.publicKey, UInt64.one);

  }
}
