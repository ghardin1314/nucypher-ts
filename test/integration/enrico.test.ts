/* eslint-disable @typescript-eslint/no-explicit-any */
import { Conditions, ConditionSet, Enrico, PolicyMessageKit } from '../../src';
import { RetrievalResult } from '../../src/kits/retrieval';
import { toBytes } from '../../src/utils';
import {
  bytesEqual,
  fromBytes,
  mockAlice,
  mockBob,
  reencryptKFrags,
} from '../utils';

describe('enrico', () => {
  it('alice decrypts message encrypted by enrico', async () => {
    const label = 'fake-label';
    const message = 'fake-message';
    const alice = mockAlice();

    const policyKey = alice.getPolicyEncryptingKeyFromLabel(label);
    const enrico = new Enrico(policyKey);
    const encrypted = enrico.encryptMessage(toBytes(message));

    const aliceKeyring = (alice as any).keyring;
    const aliceSk = await aliceKeyring.getSecretKeyFromLabel(label);
    const alicePlaintext = encrypted.decrypt(aliceSk);
    expect(alicePlaintext).toEqual(alicePlaintext);
  });

  it('bob decrypts reencrypted message', async () => {
    const label = 'fake-label';
    const alice = mockAlice();
    const bob = mockBob();

    const policyEncryptingKey = alice.getPolicyEncryptingKeyFromLabel(label);
    const enrico = new Enrico(policyEncryptingKey);

    const plaintext = 'Plaintext message';
    const plaintextBytes = toBytes(plaintext);
    const encrypted = enrico.encryptMessage(plaintextBytes);

    // Alice can decrypt capsule she created
    const aliceSk = await (alice as any).keyring.getSecretKeyFromLabel(label);
    const plaintextAlice = encrypted.decrypt(aliceSk);
    expect(fromBytes(plaintextAlice).endsWith(plaintext)).toBeTruthy();

    const threshold = 2;
    const shares = 3;
    const { verifiedKFrags, delegatingKey } = alice.generateKFrags(
      bob,
      label,
      threshold,
      shares
    );
    expect(delegatingKey.toBytes()).toEqual(policyEncryptingKey.toBytes());

    // Bob can decrypt re-encrypted ciphertext
    const { verifiedCFrags } = reencryptKFrags(
      verifiedKFrags,
      encrypted.capsule
    );
    const bobSk = (bob as any).keyring.secretKey;

    const plaintextBob = encrypted.decryptReencrypted(
      bobSk,
      policyEncryptingKey,
      verifiedCFrags
    );
    expect(fromBytes(plaintextBob).endsWith(plaintext)).toBeTruthy();

    // Bob can decrypt ciphertext and verify origin of the message
    const cFragsWithUrsulas = verifiedCFrags.map((cFrag, index) => [
      `0x${index}`,
      cFrag,
    ]);
    const result = new RetrievalResult(Object.fromEntries(cFragsWithUrsulas));
    const pk = PolicyMessageKit.fromMessageKit(
      encrypted,
      policyEncryptingKey,
      threshold
    ).withResult(result);
    expect(pk.isDecryptableByReceiver()).toBeTruthy();

    const decrypted = bob.decrypt(pk);
    expect(bytesEqual(decrypted, plaintextBytes)).toBeTruthy();
  });

  it('enrico generates a message kit with conditions', async () => {
    const label = 'fake-label';
    const message = 'fake-message';
    const alice = mockAlice();

    const policyKey = alice.getPolicyEncryptingKeyFromLabel(label);

    const ownsBufficornNFT = Conditions.ERC721Ownership.fromObj({
      contractAddress: '0x1e988ba4692e52Bc50b375bcC8585b95c48AaD77',
      parameters: [3591],
    });

    const conditions = new ConditionSet([ownsBufficornNFT]);

    const enrico = new Enrico(policyKey, undefined, conditions);
    const encrypted = enrico.encryptMessage(toBytes(message));

    const aliceKeyring = (alice as any).keyring;
    const aliceSk = await aliceKeyring.getSecretKeyFromLabel(label);
    const alicePlaintext = encrypted.decrypt(aliceSk);
    expect(alicePlaintext).toEqual(alicePlaintext);
  });

  it('can overwrite conditions at encryption time', async () => {
    const label = 'fake-label';
    const message = 'fake-message';
    const alice = mockAlice();

    const policyKey = alice.getPolicyEncryptingKeyFromLabel(label);

    const ownsBufficornNFT = new Conditions.ERC721Ownership({
      contractAddress: '0x1e988ba4692e52Bc50b375bcC8585b95c48AaD77',
      chain: 5,
      parameters: [3591],
    });

    const ownsNonsenseNFT = new Conditions.ERC721Ownership({
      contractAddress: '0x1e988ba4692e52Bc50b375bcC8585b95c48AaD77',
      chain: 5,
      parameters: [6969],
    });

    const conditions = new ConditionSet([ownsBufficornNFT]);
    const updatedConditions = new ConditionSet([ownsNonsenseNFT]);

    const enrico = new Enrico(policyKey, undefined, conditions);
    const encrypted = enrico.encryptMessage(
      toBytes(message),
      updatedConditions
    );

    const aliceKeyring = (alice as any).keyring;
    const aliceSk = await aliceKeyring.getSecretKeyFromLabel(label);
    const alicePlaintext = encrypted.decrypt(aliceSk);
    expect(alicePlaintext).toEqual(alicePlaintext);
  });
});
