import * as umbral from 'umbral-pre';

import * as cryptoApi from '../src/crypto/api';
import { GetUrsulasResponse, IUrsula, Porter } from '../src/characters/porter';
import { PolicyMessageKit } from '../src/crypto/kits';
import {
  PrePublishedTreasureMap,
  PublishedTreasureMap,
  WorkOrder,
  WorkOrderResult,
} from '../src/policies/collections';
import {
  UmbralCapsule,
  UmbralCapsuleWithFrags,
  UmbralCFrag,
  UmbralKFrag,
  UmbralPublicKey,
} from '../src/types';
import { NucypherKeyring } from '../src/crypto/keyring';
import { Alice, Bob } from '../src';
import axios from 'axios';
import { Arrangement, BlockchainPolicy } from '../src/policies/policy';
import { Ursula } from '../src/characters/ursula';
import { keccakDigest } from '../src/crypto/api';

export const mockBob = (): Bob => {
  const bobKeyringSeed = Buffer.from('fake-keyring-seed-32-bytes-bob-x');
  const bobKeyring = new NucypherKeyring(bobKeyringSeed);
  return Bob.fromKeyring(bobKeyring);
};

export const mockRemoteBob = (): Bob => {
  const bob = mockBob();
  return Bob.fromPublicKeys(bob.signer.verifyingKey(), bob.encryptingPublicKey);
};

export const mockAlice = () => {
  const aliceKeyringSeed = Buffer.from('fake-keyring-seed-32-bytes-alice');
  const aliceKeyring = new NucypherKeyring(aliceKeyringSeed);
  return Alice.fromKeyring(aliceKeyring);
};

export const mockUrsulas = (): IUrsula[] => {
  return [
    {
      encryptingKey:
        '025a335eca37edce8191d43c156e7bc6b451b21e5258759966bbfe0e6ce44543cb',
      checksumAddress: '0x5cF1703A1c99A4b42Eb056535840e93118177232'.toLowerCase(),
      uri: 'https://example.a.com:9151',
    },
    {
      encryptingKey:
        '02b0a0099ee180b531b4937bd7446972296447b2479ca6259cb6357ed98b90da3a',
      checksumAddress: '0x7fff551249D223f723557a96a0e1a469C79cC934',
      uri: 'https://example.b.com:9151',
    },
    {
      encryptingKey:
        '02761c765e2f101df39a5f680f3943d0d993ef9576de8a3e0e5fbc040d6f8c15a5',
      checksumAddress: '0x9C7C824239D3159327024459Ad69bB215859Bd25',
      uri: 'https://example.c.com:9151',
    },
    {
      encryptingKey:
        '0258b7c79fe73f3499de91dd5a5341387184035d0555b10e6ac762d211a39684c0',
      checksumAddress: '0x9919C9f5CbBAA42CB3bEA153E14E16F85fEA5b5D',
      uri: 'https://example.d.com:9151',
    },
    {
      encryptingKey:
        '02e43a623c24db4f62565f82b6081044c1968277edfdca494a81c8fd0826e0adf6',
      checksumAddress: '0xfBeb3368735B3F0A65d1F1E02bf1d188bb5F5BE6',
      uri: 'https://example.e.com:9151',
    },
  ].map(({ encryptingKey, checksumAddress, uri }) => {
    return {
      checksumAddress: checksumAddress.toLowerCase(),
      encryptingKey: encryptingKey.toLowerCase(),
      uri,
    };
  });
};

export const mockPorterUrsulas = (
  mockUrsulas: IUrsula[]
): GetUrsulasResponse => {
  return {
    result: {
      ursulas: mockUrsulas.map(u => ({
        encrypting_key: u.encryptingKey,
        uri: u.uri,
        checksum_address: u.checksumAddress,
      })),
    },
    version: '5.2.0',
  };
};

export const mockPublishedTreasureMap = (
  m: number,
  messageKit: PolicyMessageKit,
  treasureMap: PrePublishedTreasureMap
): PublishedTreasureMap => {
  const { hrac, publicSignature, payload, destinations } = treasureMap;
  return new PublishedTreasureMap(
    hrac,
    publicSignature,
    payload,
    messageKit,
    destinations,
    m
  );
};

export const mockGetUrsulas = (ursulas: IUrsula[]) => {
  return jest.spyOn(axios, 'get').mockImplementationOnce(async () => {
    return Promise.resolve({ data: mockPorterUrsulas(ursulas) });
  });
};

export const mockPublishTreasureMapOnce = () => {
  return jest
    .spyOn(Porter, 'publishTreasureMap')
    .mockImplementationOnce(async () => {
      return Promise.resolve();
    });
};

export const mockPublishToBlockchain = () => {
  return jest
    .spyOn(BlockchainPolicy.prototype, 'publishToBlockchain')
    .mockImplementation(() => {
      return '0xfakeTxHash'; // Will fail on parsing
    });
};

export const mockProposeArrangement = () => {
  return jest
    .spyOn(Ursula, 'proposeArrangement')
    .mockImplementation((ursula: IUrsula) => ursula.checksumAddress);
};

export const mockEnactArrangement = () => {
  return jest
    .spyOn(BlockchainPolicy.prototype, 'enactArrangement')
    .mockImplementation(
      (
        _arrangement: Arrangement,
        _kFrag: UmbralCFrag,
        ursula: IUrsula,
        _publicationTransaction: any
      ) => {
        return ursula.checksumAddress;
      }
    );
};

export const mockGetTreasureMapOnce = (
  m: number,
  messageKit: PolicyMessageKit,
  treasureMap: PrePublishedTreasureMap
) => {
  return jest
    .spyOn(Porter, 'getTreasureMap')
    .mockImplementationOnce(
      async (_treasureMapId: string, _bobEncryptingKey: UmbralPublicKey) => {
        return Promise.resolve(
          mockPublishedTreasureMap(m, messageKit, treasureMap)
        );
      }
    );
};

export const mockWorkOrderResults = (
  ursulas: IUrsula[],
  kFrags: UmbralKFrag[],
  capsule: UmbralCapsule
) => {
  const results: Record<string, WorkOrderResult> = {};
  for (let i = 0; i < ursulas.length; i += 1) {
    const kFrag = i < kFrags.length ? kFrags[i] : kFrags[i - kFrags.length];
    const ursula = ursulas[i];
    const cFrag = umbral.reencrypt(capsule, kFrag);
    // TODO; What is the reencryptionSignature anyway?
    const reencryptionSignature = Buffer.concat([
      keccakDigest(Buffer.from(cFrag.toBytes())),
      keccakDigest(Buffer.from(cFrag.toBytes())),
    ]);
    results[ursula.checksumAddress] = new WorkOrderResult(
      cFrag,
      umbral.Signature.fromBytes(reencryptionSignature)
    );
  }
  return results;
};

export const mockExecuteWorkOrder = (
  kFrags: UmbralKFrag[],
  capsule: UmbralCapsule,
  ursulas: IUrsula[]
) => {
  const results = mockWorkOrderResults(ursulas, kFrags, capsule);
  return jest
    .spyOn(Porter, 'executeWorkOrder')
    .mockImplementation(async (workOrder: WorkOrder) => {
      return Promise.resolve(results[workOrder.ursula.checksumAddress]);
    });
};

export const mockGenerateKFrags = () => {
  return jest.spyOn(Alice.prototype as any, 'generateKFrags');
};

export const mockEncryptAndSign = () => {
  return jest.spyOn(cryptoApi, 'encryptAndSign');
};

export const reencryptKFrags = (
  kFrags: UmbralKFrag[],
  capsule: UmbralCapsule
) => {
  if (!kFrags) {
    throw new Error('Pass at least one kFrag.');
  }
  let capsuleWithFrags: UmbralCapsuleWithFrags;
  kFrags.forEach(kFrag => {
    const cFrag = umbral.reencrypt(capsule, kFrag);
    capsuleWithFrags = capsuleWithFrags
      ? capsuleWithFrags.withCFrag(cFrag)
      : capsule.withCFrag(cFrag);
  });
  return capsuleWithFrags!;
};
