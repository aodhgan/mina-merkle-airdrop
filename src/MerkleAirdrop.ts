import {
  SmartContract,
  isReady,
  Poseidon,
  Field,
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
  Signature,
  // MerkleMap,
  MerkleMapWitness,
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

export class MerkleWitnessInstance extends MerkleWitness(8) {}

export class MerkleAirdrop extends SmartContract {
  // commitment is the root of the Merkle Tree
  @state(Field) commitment = State<Field>();

  // nullifiers are used to prevent double spending
  @state(Field) nullifiers = State<Field>();

  // total supply of tokens
  @state(UInt64) totalAmountInCirculation = State<UInt64>();

  deploy(args: DeployArgs) {
    super.deploy(args);

    const permissionToEdit = Permissions.signature();

    this.setPermissions({
      ...Permissions.default(),
      editState: Permissions.proofOrSignature(),
      setTokenSymbol: permissionToEdit,
      send: permissionToEdit,
      receive: permissionToEdit,
    });
    this.balance.addInPlace(UInt64.from(initialBalance));

    this.tokenSymbol.set(tokenSymbol);
    this.totalAmountInCirculation.set(UInt64.zero);
  }

  // token method
  @method mint(
    receiverAddress: PublicKey,
    amount: UInt64,
    adminSignature: Signature
  ) {
    let totalAmountInCirculation = this.totalAmountInCirculation.get();
    this.totalAmountInCirculation.assertEquals(totalAmountInCirculation);
    let newTotalAmountInCirculation = totalAmountInCirculation.add(amount);

    console.log('verifying signature');
    adminSignature
      .verify(
        this.address,
        amount.toFields().concat(receiverAddress.toFields())
      )
      .assertTrue();
    console.log('verified signature');

    this.token.mint({
      address: receiverAddress,
      amount,
    });
    console.log('minted!');
    this.totalAmountInCirculation.set(newTotalAmountInCirculation);
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
    this.commitment.set(preImage);
  }

  @method
  checkInclusion(account: Account, path: MerkleWitnessInstance) {
    // console.log('checkInclusion::checking inclusion for account', account.publicKey.toString());

    // we fetch the on-chain commitment
    let commitment = this.commitment.get();
    this.commitment.assertEquals(commitment);

    // we check that the account is within the committed Merkle Tree
    // console.log('checking acccount is in tree');
    path.calculateRoot(account.hash()).assertEquals(commitment);
  }

  @method
  claim(
    account: Account,
    path: MerkleWitnessInstance,
    signature: Signature,
    mmWitness: MerkleMapWitness
  ) {
    // we fetch the on-chain commitment
    let commitment = this.commitment.get();
    this.commitment.assertEquals(commitment);

    // we check that the account is within the committed Merkle Tree
    path.calculateRoot(account.hash()).assertEquals(commitment);

    // ensure this account has not been claimed before
    let _nullifiers = this.nullifiers.get();
    this.nullifiers.assertEquals(_nullifiers);

    // const initialRoot = (this.nullifiers as unknown as MerkleMap).getRoot();
    // console.log({ initialRoot })

    // eslint-disable-next-line no-unused-vars
    const [rootBefore, key] = mmWitness.computeRootAndKey(Field.zero);
    key.assertEquals(Field.zero);
    // rootBefore.assertEquals(_nullifiers.getRoot());

    // compute the root after setting nullifier flag
    // eslint-disable-next-line no-unused-vars
    const [rootAfter, _] = mmWitness.computeRootAndKey(Field.one);

    // set the new root
    this.nullifiers.set(rootAfter);

    console.log({ signature });

    // now send tokens to the account
    // this.mint(account.publicKey, UInt64.one, signature);
  }
}
