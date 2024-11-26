import { ethers } from "ethers";
import { CrossChainMessenger } from "@eth-optimism/sdk";
import { L1_RPC_URL, L2_RPC_URL, BAG_L1_ADDRESS, BAG_L2_ADDRESS } from "./constants";

let provider, signer;
const L2_CHAIN_ID = 81457; // Blast Network
const TOKEN_AMOUNT = "333"; // Number of tokens to transfer
const L2_WITHDRAWAL_HASH = "0x66d3dd7b2b3c5b65cfb9a7ac7502c760b4619a296df6a33f291e87e60a0d828f"; // L2 transaction hash

const updateStatus = (message) => {
    document.getElementById("status").innerText = `Status: ${message}`;
};

const connectWallet = async (chainId) => {
    if (!window.ethereum) {
        alert("Please install MetaMask!");
        updateStatus("MetaMask not found. Install it to proceed.");
        return null;
    }

    try {
        const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
        console.log("Connected account:", accounts[0]);

        const currentChainId = parseInt(await window.ethereum.request({ method: "eth_chainId" }), 16);
        if (currentChainId !== chainId) {
            console.log("Switching to chain ID:", chainId);
            await window.ethereum.request({
                method: "wallet_switchEthereumChain",
                params: [{ chainId: `0x${chainId.toString(16)}` }],
            });
        }

        provider = new ethers.providers.Web3Provider(window.ethereum);
        signer = provider.getSigner();

        updateStatus(`Connected to ${chainId === 1 ? "Ethereum Mainnet" : "Blast Network"} with account: ${accounts[0]}`);
        return signer;
    } catch (error) {
        console.error("Wallet connection failed:", error);
        updateStatus("Failed to connect wallet or switch network.");
        return null;
    }
};

const setup = async () => {
    try {
        updateStatus("Connecting to Ethereum Mainnet...");
        signer = await connectWallet(1);
        if (!signer) throw new Error("Failed to connect to Ethereum Mainnet");

        updateStatus("Switching to Blast network...");
        await connectWallet(L2_CHAIN_ID);

        console.log("Wallet setup complete.");
    } catch (error) {
        console.error("Setup failed:", error);
        updateStatus("Setup failed. Please check the console for details.");
    }
};

const approveL2Bridge = async () => {
    try {
        const l2TokenContract = new ethers.Contract(
            BAG_L2_ADDRESS,
            ["function approve(address spender, uint256 amount) external returns (bool)"],
            signer
        );

        const l2StandardBridgeAddress = "0x4200000000000000000000000000000000000010";
        const amount = ethers.utils.parseUnits(TOKEN_AMOUNT, 18);

        console.log("Approving L2 Standard Bridge...");
        const tx = await l2TokenContract.approve(l2StandardBridgeAddress, amount);
        await tx.wait();

        console.log("Approval transaction hash:", tx.hash);
        updateStatus(`Approval Tx Hash: ${tx.hash}`);
    } catch (error) {
        console.error("Error during approval:", error);
        updateStatus("Error during approval.");
    }
};

const initiateWithdrawal = async () => {
    try {
        const l2BridgeAddress = "0x4200000000000000000000000000000000000010";
        const l2BridgeContract = new ethers.Contract(
            l2BridgeAddress,
            [
                "function bridgeERC20(address _localToken, address _remoteToken, uint256 _amount, uint32 _minGasLimit, bytes calldata _extraData) external"
            ],
            signer
        );

        const amount = ethers.utils.parseUnits(TOKEN_AMOUNT, 18);
        const minGasLimit = 200000;
        const extraData = "0x";

        console.log("Initiating ERC20 token bridging...");
        const tx = await l2BridgeContract.bridgeERC20(
            BAG_L2_ADDRESS,
            BAG_L1_ADDRESS,
            amount,
            minGasLimit,
            extraData
        );

        console.log("Withdrawal transaction hash:", tx.hash);
        updateStatus(`Initiate Tx Hash: ${tx.hash}`);
    } catch (error) {
        console.error("Error during withdrawal initiation:", error);
        updateStatus("Error during withdrawal initiation.");
    }
};

const proveWithdrawal = async () => {
    try {
        console.log("Switching to Blast network to locate the withdrawal transaction...");
        await connectWallet(L2_CHAIN_ID); // Ensure connected to Blast network

        console.log("Initializing CrossChainMessenger for Blast...");
        const messenger = new CrossChainMessenger({
            l1SignerOrProvider: signer,
            l2SignerOrProvider: signer,
            l1ChainId: 1, // Ethereum Mainnet
            l2ChainId: L2_CHAIN_ID, // Blast network
            contracts: {
                l1: {
                    AddressManager: "0xE064B565Cf2A312a3e66Fe4118890583727380C0",
                    L1CrossDomainMessenger: "0x5D4472f31Bd9385709ec61305AFc749F0fA8e9d0",
                    L1StandardBridge: "0x697402166Fbf2F22E970df8a6486Ef171dbfc524",
                    OptimismPortal: "0x0Ec68c5B10F21EFFb74f2A5C61DFe6b08C0Db6Cb",
                    L2OutputOracle: "0x826D1B0D4111Ad9146Eb8941D7Ca2B6a44215c76",
                    StateCommitmentChain: ethers.constants.AddressZero,
                    CanonicalTransactionChain: ethers.constants.AddressZero,
                    BondManager: ethers.constants.AddressZero,
                },
                l2: {
                    L2CrossDomainMessenger: "0x4200000000000000000000000000000000000007",
                    L2ToL1MessagePasser: "0x4200000000000000000000000000000000000016",
                    L2StandardBridge: "0x4200000000000000000000000000000000000010",
                },
            },
        });

        console.log("Messenger initialized on Blast network. Fetching cross-chain message...");
        
        const message = await messenger.toCrossChainMessage(L2_WITHDRAWAL_HASH);
        console.log("Cross-chain message details:", message);

        if (!message) {
            throw new Error("No cross-chain message found for the given withdrawal hash.");
        }

        console.log("Switching to Ethereum Mainnet for proving...");
        await connectWallet(1); // Switch to Ethereum Mainnet

        console.log("Proving withdrawal transaction...");
        const tx = await messenger.proveMessage(L2_WITHDRAWAL_HASH);
        console.log("Prove transaction hash:", tx.hash);
        updateStatus(`Prove Tx Hash: ${tx.hash}`);
    } catch (error) {
        console.error("Error during proving withdrawal transaction:", error);
        updateStatus("Error during proving withdrawal transaction. Check console for details.");
    }
};







document.getElementById("approve").addEventListener("click", approveL2Bridge);
document.getElementById("initiate").addEventListener("click", initiateWithdrawal);
document.getElementById("prove").addEventListener("click", proveWithdrawal);



setup();
