import { ethers } from 'ethers';

// Validate Ethereum address checksum
const validateAddress = (address, name) => {
    if (!ethers.utils.isAddress(address) || ethers.utils.getAddress(address) !== address) {
        console.error(`${name} is not a valid checksummed address: ${address}`);
        throw new Error(`${name} is not a valid checksummed address.`);
    }
};

// RPC URLs
export const L1_RPC_URL = "https://mainnet.infura.io/v3/0a48a1248e7146f4a50ed24c18edede5";
export const L2_RPC_URL = "https://blast-mainnet.infura.io/v3/0a48a1248e7146f4a50ed24c18edede5";

// BAG Token Addresses
export const BAG_L1_ADDRESS = "0x808688c820AB080A6Ff1019F03E5EC227D9b522B";
export const BAG_L2_ADDRESS = "0xb9dfCd4CF589bB8090569cb52FaC1b88Dbe4981F";

// Validate addresses
validateAddress(BAG_L1_ADDRESS, "BAG_L1_ADDRESS");
validateAddress(BAG_L2_ADDRESS, "BAG_L2_ADDRESS");

// L1 Contracts
export const L1_CONTRACTS = {
    AddressManager: "0xE064B565Cf2A312a3e66Fe4118890583727380C0",
    L1CrossDomainMessenger: "0x5D4472f31Bd9385709ec61305AFc749F0fA8e9d0",
    L1StandardBridge: "0x697402166Fbf2F22E970df8a6486Ef171dbfc524",
    OptimismPortal: "0x0Ec68c5B10F21EFFb74f2A5C61DFe6b08C0Db6Cb",
    L2OutputOracle: "0x826D1B0D4111Ad9146Eb8941D7Ca2B6a44215c76",
    StateCommitmentChain: ethers.constants.AddressZero,
    CanonicalTransactionChain: ethers.constants.AddressZero,
    BondManager: ethers.constants.AddressZero,
};

// L2 Contracts
export const L2_CONTRACTS = {
    StandardBridge: "0x4200000000000000000000000000000000000010"
};

