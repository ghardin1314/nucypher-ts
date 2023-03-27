import { MessageKit, VerifiedKeyFrag } from '@nucypher/nucypher-core';
import { providers } from 'ethers';

import {
  Cohort,
  Conditions,
  ConditionSet,
  SecretKey,
  Strategy,
} from '../../src';
import { Ursula } from '../../src/characters/porter';
import { toBytes } from '../../src/utils';
import {
  mockDetectEthereumProvider,
  mockEncryptTreasureMap,
  mockGenerateKFrags,
  mockGetUrsulas,
  mockMakeTreasureMap,
  mockPublishToBlockchain,
  mockRetrieveCFragsRequest,
  mockUrsulas,
  mockWeb3Provider,
} from '../utils';

describe('Get Started (CBD PoC)', () => {
  function mockRetrieveAndDecrypt(
    makeTreasureMapSpy: jest.SpyInstance,
    encryptedMessageKit: MessageKit
  ) {
    // Setup mocks for `retrieveAndDecrypt`
    const ursulaAddresses = (
      makeTreasureMapSpy.mock.calls[0][0] as readonly Ursula[]
    ).map((u) => u.checksumAddress);
    const verifiedKFrags = makeTreasureMapSpy.mock
      .calls[0][1] as readonly VerifiedKeyFrag[];
    return mockRetrieveCFragsRequest(
      ursulaAddresses,
      verifiedKFrags,
      encryptedMessageKit.capsule
    );
  }

  it('can run the get started example', async () => {
    const detectEthereumProvider = mockDetectEthereumProvider();
    const mockedUrsulas = mockUrsulas();
    const getUrsulasSpy = mockGetUrsulas(mockedUrsulas);
    const generateKFragsSpy = mockGenerateKFrags();
    const publishToBlockchainSpy = mockPublishToBlockchain();
    const makeTreasureMapSpy = mockMakeTreasureMap();
    const encryptTreasureMapSpy = mockEncryptTreasureMap();

    jest
      .spyOn(providers, 'Web3Provider')
      .mockImplementation(() =>
        mockWeb3Provider(SecretKey.random().toSecretBytes())
      );

    //
    // Start of the code example
    //

    // 2. Build a Cohort
    const config = {
      threshold: 3,
      shares: 5,
      porterUri: 'https://porter-tapir.nucypher.community',
    };
    const newCohort = await Cohort.create(config);

    // 3. Specify default Conditions
    const NFTOwnership = new Conditions.ERC721Ownership({
      contractAddress: '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D',
      chain: 5, // Tapir network uses Görli testnet
      parameters: [5954],
    });

    const conditions = new ConditionSet([
      NFTOwnership,
      // Other conditions can be added here
    ]);

    // 4. Build a Strategy
    const newStrategy = Strategy.create(newCohort, conditions);

    const MMprovider = await detectEthereumProvider();
    const mumbai = providers.getNetwork(80001);

    const web3Provider = new providers.Web3Provider(MMprovider, mumbai);
    const newDeployed = await newStrategy.deploy('test', web3Provider);

    // 5. Encrypt the plaintext & update Conditions
    const NFTBalanceConfig = {
      contractAddress: '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D',
      standardContractType: 'ERC721',
      chain: 5,
      method: 'balanceOf',
      parameters: [':userAddress'],
      returnValueTest: {
        comparator: '>=',
        value: 3,
      },
    };
    const NFTBalance = new Conditions.Condition(NFTBalanceConfig);

    const encrypter = newDeployed.encrypter;

    const plaintext = 'this is a secret';
    const encryptedMessageKit = encrypter.encryptMessage(
      plaintext,
      new ConditionSet([NFTBalance])
    );

    // Mocking - Not a part of any code example
    const retrieveCFragsSpy = mockRetrieveAndDecrypt(
      makeTreasureMapSpy,
      encryptedMessageKit
    );

    // 6. Request decryption rights
    const decryptedMessage = await newDeployed.decrypter.retrieveAndDecrypt(
      [encryptedMessageKit],
      web3Provider
    );

    //
    // End of the code example
    //

    const expectedAddresses = mockUrsulas().map((u) => u.checksumAddress);
    const condObj = conditions.conditions[0].toObj();
    expect(newCohort.ursulaAddresses).toEqual(expectedAddresses);
    expect(condObj.parameters).toEqual([5954]);
    expect(condObj.chain).toEqual(5);
    expect(condObj.contractAddress).toEqual(
      '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D'
    );
    expect(conditions.validate()).toEqual(true);
    expect(publishToBlockchainSpy).toHaveBeenCalled();
    expect(newDeployed.label).toEqual('test');
    expect(getUrsulasSpy).toHaveBeenCalledTimes(2);
    expect(generateKFragsSpy).toHaveBeenCalled();
    expect(encryptTreasureMapSpy).toHaveBeenCalled();
    expect(makeTreasureMapSpy).toHaveBeenCalled();
    expect(retrieveCFragsSpy).toHaveBeenCalled();
    expect(decryptedMessage[0]).toEqual(toBytes(plaintext));
  });
});
