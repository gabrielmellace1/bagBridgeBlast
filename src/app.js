import { ethers } from "ethers";
import { CrossChainMessenger } from "@eth-optimism/sdk";
import { L1_RPC_URL, L2_RPC_URL, BAG_L1_ADDRESS, BAG_L2_ADDRESS, L1_CONTRACTS } from "./constants";

let l1Provider, l2Provider, l1Signer;
const L2_CHAIN_ID = 81457; // Blast Network
const TOKEN_AMOUNT = "333"; // Number of tokens to transfer
const L2_WITHDRAWAL_HASH = "0x66d3dd7b2b3c5b65cfb9a7ac7502c760b4619a296df6a33f291e87e60a0d828f"; // L2 transaction hash

const updateStatus = (message) => {
    document.getElementById("status").innerText = `Status: ${message}`;
};

// Initialize providers
const initializeProviders = async () => {
    try {
        // L1 provider for Ethereum Mainnet
        l1Provider = new ethers.providers.Web3Provider(window.ethereum);
        l1Signer = l1Provider.getSigner();

        // L2 provider for Blast (read-only)
        l2Provider = new ethers.providers.JsonRpcProvider(L2_RPC_URL);

        console.log("Providers initialized for Ethereum Mainnet and Blast.");
        updateStatus("Providers initialized.");
    } catch (error) {
        console.error("Error initializing providers:", error);
        updateStatus("Error initializing providers. Check console for details.");
    }
};

const approveL2Bridge = async () => {
    try {
        const l2TokenContract = new ethers.Contract(
            BAG_L2_ADDRESS,
            ["function approve(address spender, uint256 amount) external returns (bool)"],
            l1Signer // Use the Ethereum Mainnet signer
        );

        const l2StandardBridgeAddress = L1_CONTRACTS.L1StandardBridge;
        const amount = ethers.utils.parseUnits(TOKEN_AMOUNT, 18);

        console.log("Approving L2 Standard Bridge...");
        const tx = await l2TokenContract.approve(l2StandardBridgeAddress, amount);
        await tx.wait();

        console.log("Approval transaction hash:", tx.hash);
        updateStatus(`Approval Tx Hash: ${tx.hash}`);
    } catch (error) {
        console.error("Error during approval:", error);
        updateStatus("Error during approval. Check console for details.");
    }
};

const initiateWithdrawal = async () => {
    try {
        const l2BridgeContract = new ethers.Contract(
            L1_CONTRACTS.L1StandardBridge,
            [
                "function bridgeERC20(address _localToken, address _remoteToken, uint256 _amount, uint32 _minGasLimit, bytes calldata _extraData) external"
            ],
            l1Signer // Use the Ethereum Mainnet signer
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
        updateStatus("Error during withdrawal initiation. Check console for details.");
    }
};

const proveWithdrawal = async () => {
    try {
        console.log("Initializing CrossChainMessenger for proving...");
        const messenger = new CrossChainMessenger({
            l1SignerOrProvider: l1Signer, // Ethereum Mainnet signer for signing operations
            l2SignerOrProvider: l2Provider, // Blast RPC provider for reading operations
            l1ChainId: 1, // Ethereum Mainnet
            l2ChainId: L2_CHAIN_ID, // Blast Network
            contracts: {
                l1: L1_CONTRACTS,
                l2: {
                    L2CrossDomainMessenger: "0x4200000000000000000000000000000000000007",
                    L2ToL1MessagePasser: "0x4200000000000000000000000000000000000016",
                    L2StandardBridge: "0x4200000000000000000000000000000000000010",
                },
            },
        });

        console.log("Messenger initialized. Fetching cross-chain message...");
        const message = await messenger.toCrossChainMessage(L2_WITHDRAWAL_HASH);
        console.log("Cross-chain message details:", message);

        if (!message) {
            throw new Error("No cross-chain message found for the given withdrawal hash.");
        }

        console.log("Proving withdrawal transaction on Ethereum Mainnet...");
        const tx = await messenger.proveMessage(L2_WITHDRAWAL_HASH);
        console.log("Prove transaction hash:", tx.hash);
        updateStatus(`Prove Tx Hash: ${tx.hash}`);
    } catch (error) {
        console.error("Error during proving withdrawal transaction:", error);
        updateStatus("Error during proving withdrawal transaction. Check console for details.");
    }
};


const finalizeWithdrawal = async () => {
    try {
        console.log("Checking withdrawal status before finalizing...");

        // Initialize the CrossChainMessenger
        const messenger = new CrossChainMessenger({
            l1SignerOrProvider: l1Signer,
            l2SignerOrProvider: l2Provider,
            l1ChainId: 1, // Ethereum Mainnet
            l2ChainId: L2_CHAIN_ID, // Blast Network
            contracts: {
                l1: L1_CONTRACTS,
                l2: {
                    L2CrossDomainMessenger: "0x4200000000000000000000000000000000000007",
                    L2ToL1MessagePasser: "0x4200000000000000000000000000000000000016",
                    L2StandardBridge: "0x4200000000000000000000000000000000000010",
                },
            },
        });

        // Check the message status
        const messageStatus = await messenger.getMessageStatus(L2_WITHDRAWAL_HASH);
        console.log("Message Status:", messageStatus);

        if (messageStatus !== "READY_TO_FINALIZE") {
            console.log("Message is not ready to finalize. Current status:", messageStatus);
            updateStatus(`Message not ready to finalize. Status: ${messageStatus}`);
            return;
        }

        console.log("Fetching low-level message details...");
        const lowLevelMessage = await messenger.toLowLevelMessage(L2_WITHDRAWAL_HASH);

        if (!lowLevelMessage) {
            throw new Error("No low-level message found for the given withdrawal hash.");
        }

        console.log("Initializing OptimismPortal contract...");
        const optimismPortal = new ethers.Contract(
            L1_CONTRACTS.OptimismPortal, // OptimismPortal contract address
            [
                "function finalizeWithdrawalTransaction(uint256 hintId, bytes calldata lowLevelMessage) external"
            ],
            l1Signer
        );

        const hintId = 0; // Hint ID, set to 0 for ERC20 transfers

        console.log("Finalizing withdrawal transaction...");
        const finalizeTx = await optimismPortal.finalizeWithdrawalTransaction(hintId, lowLevelMessage);
        console.log("Finalize transaction hash:", finalizeTx.hash);
        updateStatus(`Finalize Tx Hash: ${finalizeTx.hash}`);
    } catch (error) {
        console.error("Error during finalizing withdrawal transaction:", error);
        updateStatus("Error during finalizing withdrawal transaction. Check console for details.");
    }
};






// Initialize everything on page load
initializeProviders();

document.getElementById("approve").addEventListener("click", approveL2Bridge);
document.getElementById("initiate").addEventListener("click", initiateWithdrawal);
document.getElementById("prove").addEventListener("click", proveWithdrawal);
document.getElementById("withdraw").addEventListener("click", finalizeWithdrawal);