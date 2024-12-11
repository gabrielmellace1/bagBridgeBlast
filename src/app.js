import { ethers } from "ethers";
import { CrossChainMessenger } from "@eth-optimism/sdk";
import { L1_RPC_URL, L2_RPC_URL, BAG_L1_ADDRESS, BAG_L2_ADDRESS, L1_CONTRACTS ,L2_CONTRACTS} from "./constants";

let l1Provider, l2Provider;
let userWalletAddress = ""; // Tracks the connected wallet address
let amountInWei = ethers.constants.Zero; // Tracks the entered amount in WEI
let withdrawalHash = ""; // Tracks the withdrawal transaction hash

const L2_CHAIN_ID = 81457; // Blast Network
const DECIMALS = 18; // For BAG tokens

const updateConsoleLog = (message) => {
    const logElement = document.getElementById("console-log");
    if (logElement) {
        logElement.innerText = message;
    } else {
        console.error("Console log element not found. Message:", message);
    }
};

const connectWallet = async () => {
    try {
        updateConsoleLog("Connecting to MetaMask...");
        if (!window.ethereum) {
            alert("MetaMask is not installed. Please install it to proceed.");
            updateConsoleLog("MetaMask not found.");
            return;
        }

        const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
        userWalletAddress = accounts[0];
        updateConsoleLog(`Connected wallet: ${userWalletAddress}`);
        document.getElementById("amount").disabled = false;
        document.getElementById("tx-hash").disabled = false;
        // Disable the connect button after a successful connection
        document.getElementById("connect").disabled = true;
    } catch (error) {
        console.error("Error connecting wallet:", error);
        updateConsoleLog(`Error connecting wallet: ${error.message}`);
    }
};
const checkAllowance = async () => {
    try {
        updateConsoleLog("Checking allowance and balance on Blast (L2)...");

        // Read the value from the amount input
        const amountInput = document.getElementById("amount").value.trim();
        const amountToCheck = amountInput && !isNaN(amountInput) ? parseFloat(amountInput) : 0;

        if (amountToCheck <= 0) {
            console.log("Invalid or zero amount entered. Buttons disabled.");
            document.getElementById("approve").disabled = true;
            document.getElementById("initiate").disabled = true;
            return;
        }

        const l2TokenContract = new ethers.Contract(
            BAG_L2_ADDRESS,
            [
                "function allowance(address owner, address spender) external view returns (uint256)",
                "function balanceOf(address account) external view returns (uint256)"
            ],
            new ethers.providers.JsonRpcProvider(L2_RPC_URL)
        );

        const spender = "0x4200000000000000000000000000000000000010"; // L2 Standard Bridge
        const allowance = await l2TokenContract.allowance(userWalletAddress, spender);
        const balance = await l2TokenContract.balanceOf(userWalletAddress);

        // Convert allowance, balance, and input amount to ETH
        const allowanceInEth = parseFloat(ethers.utils.formatUnits(allowance, DECIMALS));
        const balanceInEth = parseFloat(ethers.utils.formatUnits(balance, DECIMALS));
        const amountInEth = parseFloat(amountToCheck);

        console.log(`You put on the input this amount: ${amountInEth} BAG`);
        console.log(`You have this allowance: ${allowanceInEth} BAG`);
        console.log(`You have this balance: ${balanceInEth} BAG`);

        // Reset button states
        document.getElementById("approve").disabled = true;
        document.getElementById("initiate").disabled = true;

        if (allowanceInEth >= amountInEth) {
            console.log("Your allowance is sufficient.");
            if (balanceInEth >= amountInEth) {
                console.log("Your balance is sufficient.");
                document.getElementById("initiate").disabled = false;
                console.log("Initiate button is enabled.");
            } else {
                console.log("Your balance is insufficient.");
                document.getElementById("initiate").disabled = true;
                console.log("Initiate button is disabled.");
            }
            document.getElementById("approve").disabled = true;
            console.log("Approve button is disabled.");
        } else {
            console.log("Your allowance is insufficient.");
            document.getElementById("approve").disabled = false;
            console.log("Approve button is enabled.");
            document.getElementById("initiate").disabled = true;
            console.log("Initiate button is disabled.");
        }

        console.log(`Final button states - Approve: ${!document.getElementById("approve").disabled}, Initiate: ${!document.getElementById("initiate").disabled}`);
    } catch (error) {
        console.error("Error checking allowance and balance:", error);
        updateConsoleLog(`Error checking allowance and balance: ${error.message}`);
    }
};


const approveL2Bridge = async () => {
    try {
        updateConsoleLog("Switching to Blast network...");

        // Switch to Blast network
        await window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: `0x${L2_CHAIN_ID.toString(16)}` }],
        });

        // Generate signer for the Blast network
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const signer = provider.getSigner();

        // Initialize the L2 token contract
        const l2TokenContract = new ethers.Contract(
            BAG_L2_ADDRESS,
            ["function approve(address spender, uint256 amount) external returns (bool)"],
            signer
        );

        // Convert the amount to WEI
        const amountInput = document.getElementById("amount").value.trim();
        const amountToApprove = amountInput && !isNaN(amountInput) ? parseFloat(amountInput) : 0;
        const amountInWei = ethers.utils.parseUnits(amountToApprove.toString(), DECIMALS);

        updateConsoleLog("Sending approval transaction...");
        const tx = await l2TokenContract.approve("0x4200000000000000000000000000000000000010", amountInWei);

        updateConsoleLog("Approval transaction sent...");
        await tx.wait();

        updateConsoleLog(`Approval confirmed: ${tx.hash}`);

        checkAllowance();  
    } catch (error) {
        console.error("Error during approval:", error);
        updateConsoleLog(`Error during approval: ${error.message}`);
    }
};


const initiateWithdrawal = async () => {
    try {
        // Fetch the amount entered by the user from the input field
        const amountInput = document.getElementById("amount").value.trim();
        console.log("Retrieved Amount Input:", amountInput); // Check what is actually retrieved

        const amountToCheck = amountInput && !isNaN(parseFloat(amountInput)) && parseFloat(amountInput) > 0 ? amountInput : "0";
        console.log("Amount to Check:", amountToCheck); // Check the conditionally parsed value

        if (amountToCheck === "0") {
            updateConsoleLog("The amount has to be greater than 0.");
            return; // Exit the function if the amount is not valid
        }

        // Define DECIMALS based on your token's decimals
        const DECIMALS = 18; // Common for ETH and many ERC-20 tokens
        const amountInWei = ethers.utils.parseUnits(amountToCheck, DECIMALS);
        console.log("Amount in Wei:", amountInWei.toString()); // Check the conversion result

        // Switch to Blast network
        const targetChainId = 81457; // Blast Network
        const currentChainId = parseInt(await window.ethereum.request({ method: "eth_chainId" }), 16);
        console.log("Current Network ID:", currentChainId);

        if (currentChainId !== targetChainId) {
            updateConsoleLog("Switching to Blast Network...");
            await window.ethereum.request({
                method: "wallet_switchEthereumChain",
                params: [{ chainId: `0x${targetChainId.toString(16)}` }],
            });
        }

        // Initialize signer and contract
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const signer = provider.getSigner();
        const l2BridgeContract = new ethers.Contract(
            L2_CONTRACTS.StandardBridge,
            [
                "function bridgeERC20(address _localToken, address _remoteToken, uint256 _amount, uint32 _minGasLimit, bytes calldata _extraData) external"
            ],
            signer
        );

        // Initiate the withdrawal
        const tx = await l2BridgeContract.bridgeERC20(
            BAG_L2_ADDRESS,
            BAG_L1_ADDRESS,
            amountInWei,
            200000, // Consider dynamically setting this based on estimated gas if possible
            "0x"
        );
        updateConsoleLog("Withdrawal transaction sent...");

        // Wait for the transaction to be mined
        const receipt = await tx.wait();
        withdrawalHash = receipt.transactionHash;

        // Auto-fill the transaction hash input
        document.getElementById("tx-hash").value = withdrawalHash;
        updateConsoleLog(`Withdrawal initiated: ${withdrawalHash}`);
    } catch (error) {
        console.error("Error during withdrawal initiation:", error);
        updateConsoleLog(`Error during withdrawal initiation: ${error.message}`);
    }
};





const proveWithdrawal = async () => {
    try {
        // Retrieve the withdrawal hash from the user input
        const withdrawalHash = document.getElementById("tx-hash").value.trim();
        if (!withdrawalHash) {
            updateConsoleLog("No withdrawal hash provided.");
            return;
        }

        // Ensure you are on Ethereum Mainnet
        const requiredChainId = 1; // Ethereum Mainnet chain ID
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const currentChainId = parseInt(await provider.getNetwork().then(net => net.chainId), 10);
        updateConsoleLog(`Current network ID: ${currentChainId}`);

        if (currentChainId !== requiredChainId) {
            updateConsoleLog("Switching to Ethereum Mainnet...");
            await window.ethereum.request({
                method: "wallet_switchEthereumChain",
                params: [{ chainId: `0x${requiredChainId.toString(16)}` }],
            });
        }

        const l1Provider = new ethers.providers.Web3Provider(window.ethereum);
        const l1Signer = l1Provider.getSigner();
        const l2Provider = new ethers.providers.JsonRpcProvider(L2_RPC_URL);

        const messenger = new CrossChainMessenger({
            l1SignerOrProvider: l1Signer,
            l2SignerOrProvider: l2Provider,
            l1ChainId: 1,
            l2ChainId: L2_CHAIN_ID,
            contracts: { l1: L1_CONTRACTS }
        });

        console.log("Messenger initialized. Fetching message status...");
        const messageStatus = await messenger.getMessageStatus(withdrawalHash);
        console.log("Message Status:", messageStatus);

        // Handle different message statuses
        switch (messageStatus) {
            case 2: // STATE_ROOT_NOT_PUBLISHED
                updateConsoleLog("State root for the message is not yet published.");
                break;
            case 3: // READY_TO_PROVE
                updateConsoleLog("Proving withdrawal...");
                const tx = await messenger.proveMessage(withdrawalHash);
                const receipt = await tx.wait();
                updateConsoleLog(`Prove transaction confirmed: ${receipt.transactionHash}`);
                break;
            case 4: // IN_CHALLENGE_PERIOD
                updateConsoleLog("Transaction is in the challenge period.");
                break;
            case 5: // READY_FOR_RELAY
                updateConsoleLog("Please finalize the withdrawal for this hash.");
                break;
            case 6: // RELAYED
                updateConsoleLog("This transaction hash has already been bridged.");
                break;
            default:
                updateConsoleLog(`Message not ready for finalization. Status: ${messageStatus}`);
        }
    } catch (error) {
        console.error("Error proving withdrawal:", error);
        updateConsoleLog(`Error proving withdrawal: ${error.message}`);
    }
};




const finalizeWithdrawal = async () => {
    try {
        console.log("Checking current network...");
        const requiredChainId = 1; // Ethereum Mainnet chain ID
        const currentChainId = parseInt(await window.ethereum.request({ method: "eth_chainId" }), 16);

        console.log(`Current network ID: ${currentChainId}`);
        if (currentChainId !== requiredChainId) {
            console.log("Network is not Ethereum Mainnet. Switching now...");
            await window.ethereum.request({
                method: "wallet_switchEthereumChain",
                params: [{ chainId: `0x${requiredChainId.toString(16)}` }],
            });
            console.log("Switched to Ethereum Mainnet.");
        } else {
            console.log("Already on Ethereum Mainnet.");
        }

        const l1Provider = new ethers.providers.Web3Provider(window.ethereum);
        const l1Signer = l1Provider.getSigner();

        const withdrawalHash = document.getElementById("tx-hash").value.trim();
        if (!withdrawalHash) {
            console.error("No withdrawal hash provided.");
            return;
        }

        console.log("Withdrawal hash used:", withdrawalHash);

        const messenger = new CrossChainMessenger({
            l1SignerOrProvider: l1Signer,
            l2SignerOrProvider: new ethers.providers.JsonRpcProvider(L2_RPC_URL),
            l1ChainId: 1,
            l2ChainId: L2_CHAIN_ID,
            contracts: {
                l1: L1_CONTRACTS,
                l2: {
                    L2CrossDomainMessenger: "0x4200000000000000000000000000000000000007",
                    L2ToL1MessagePasser: "0x4200000000000000000000000000000000000016",
                    L2StandardBridge: "0x4200000000000000000000000000000000000010",
                },
            },
        });



        console.log("Checking message status...");
        const messageStatus = await messenger.getMessageStatus(withdrawalHash);
        updateConsoleLog(`Message Status: ${messageStatus}`);
        if (messageStatus !== 5) { // READY_FOR_RELAY
            updateConsoleLog(`Withdrawal not ready for finalization. Current status: ${messageStatus}`);
            if (messageStatus === 2) {
                updateConsoleLog("State root for the message is not yet published.");
            } else if (messageStatus === 4) {
                updateConsoleLog("Transaction is in the challenge period.");
            } else if (messageStatus === 6) {
                updateConsoleLog("This transaction hash has already been bridged.");
            }
            return;
        }
        
        console.log("Fetching low-level message details...");
        const lowLevelMessage = await messenger.toLowLevelMessage(withdrawalHash);
        if (!lowLevelMessage) {
            throw new Error("No low-level message found for the given withdrawal hash.");
        }

        console.log("Low-level message details:", JSON.stringify(lowLevelMessage));

        const transactionData = [
            lowLevelMessage.messageNonce,
            lowLevelMessage.sender,
            lowLevelMessage.target,
            lowLevelMessage.value,
            lowLevelMessage.minGasLimit,
            lowLevelMessage.message
        ];

        const optimismPortal = new ethers.Contract(
            L1_CONTRACTS.OptimismPortal,
            [
                "function finalizeWithdrawalTransaction(uint256 hintId, (uint256 nonce, address sender, address target, uint256 value, uint256 gasLimit, bytes data)) external"
            ],
            l1Signer
        );

        console.log("Finalizing withdrawal transaction...");
        const txResponse = await optimismPortal.finalizeWithdrawalTransaction(
            0,
            transactionData,
            {
                gasLimit: ethers.utils.hexlify(1000000) // Optional: Adjust gas limit as necessary
            }
        );

        console.log("Transaction sent. Waiting for confirmation...");
        const receipt = await txResponse.wait();
        console.log("Transaction confirmed in block:", receipt.blockNumber);
    } catch (error) {
        console.error("Error during finalizing withdrawal transaction:", error);
    }
};












const MessageStatus = {
    UNCONFIRMED_L1_TO_L2_MESSAGE: 0,
    FAILED_L1_TO_L2_MESSAGE: 1,
    STATE_ROOT_NOT_PUBLISHED: 2,
    READY_TO_PROVE: 3,
    IN_CHALLENGE_PERIOD: 4,
    READY_FOR_RELAY: 5,
    RELAYED: 6
};




// Event Listeners
document.getElementById("connect").addEventListener("click", connectWallet);
document.getElementById("amount").addEventListener("blur", (e) => {
    const inputAmount = e.target.value || "0";
    amountInWei = ethers.utils.parseUnits(inputAmount, DECIMALS); // Convert ETH to WEI
    updateConsoleLog(`Entered amount: ${inputAmount} ETH (${amountInWei.toString()} WEI)`);
    checkAllowance();
});
document.getElementById("tx-hash").addEventListener("input", (e) => {
    withdrawalHash = e.target.value;
    const isHashValid = /^0x([A-Fa-f0-9]{64})$/.test(withdrawalHash);
    document.getElementById("prove").disabled = !isHashValid;
    document.getElementById("finalize").disabled = !isHashValid;
});
document.getElementById("approve").addEventListener("click", approveL2Bridge);
document.getElementById("initiate").addEventListener("click", initiateWithdrawal);
document.getElementById("prove").addEventListener("click", proveWithdrawal);
document.getElementById("finalize").addEventListener("click", finalizeWithdrawal);
