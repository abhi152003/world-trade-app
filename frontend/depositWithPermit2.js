const { ethers } = require("ethers");
const dotenv = require("dotenv");
dotenv.config();

// === CONFIGURATION ===
const WLD_TOKEN_ADDRESS = "0x2cFc85d8E48F8EAB294be644d9E25C3030863003";         // WLD token contract
const VAULT_MANAGER_ADDRESS = "0xeA2c7377FD34366878516bD68CCB469016b529d9";      // VaultManagerPermit2 contract
const PERMIT2_ADDRESS = "0x000000000022D473030F116dDEE9F6B43aC78BA3";           // Universal Permit2 contract
const DEPOSIT_AMOUNT = ethers.parseUnits("0.0001", 18);                            // Amount to deposit (0.0001 WLD)

// Your wallet's private key
const PRIVATE_KEY = process.env.PRIVATE_KEY;

// World Chain mainnet RPC URL
const provider = new ethers.JsonRpcProvider("https://worldchain-mainnet.g.alchemy.com/public");

// Create signer from private key
const signer = new ethers.Wallet(PRIVATE_KEY, provider);

// Contract ABIs
const PERMIT2_ABI = [
  "function nonceBitmap(address, uint256) external view returns (uint256)"
];

const VAULT_MANAGER_ABI = [
  `function depositWithPermit2(
    uint256 amount,
    tuple(tuple(address token, uint256 amount) permitted, uint256 nonce, uint256 deadline) permitData,
    bytes signature
  ) external`
];

const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)"
];

// Permit2 EIP-712 Domain
const PERMIT2_DOMAIN = {
  name: "Permit2",
  chainId: 480, // World Chain mainnet
  verifyingContract: PERMIT2_ADDRESS
};

// Permit2 Types for PermitTransferFrom (corrected structure)
const PERMIT_TRANSFER_FROM_TYPES = {
  PermitTransferFrom: [
    { name: "permitted", type: "TokenPermissions" },
    { name: "spender", type: "address" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" }
  ],
  TokenPermissions: [
    { name: "token", type: "address" },
    { name: "amount", type: "uint256" }
  ]
};

// Contract instances
const permit2Contract = new ethers.Contract(PERMIT2_ADDRESS, PERMIT2_ABI, signer);
const vaultManagerContract = new ethers.Contract(VAULT_MANAGER_ADDRESS, VAULT_MANAGER_ABI, signer);
const tokenContract = new ethers.Contract(WLD_TOKEN_ADDRESS, ERC20_ABI, signer);

async function generateNonceFromBitmap() {
  // Get nonce bitmap similar to StakingMain.tsx
  const wordPos = 0;
  const bitmap = await permit2Contract.nonceBitmap(signer.address, BigInt(wordPos));
  
  let bitmapBigInt = BigInt(bitmap);
  let bit = 0;
  
  // Find first unused bit
  while (bit < 256) {
    if ((bitmapBigInt & (BigInt(1) << BigInt(bit))) === BigInt(0)) break;
    bit++;
  }
  
  if (bit === 256) throw new Error('No available nonce found');
  
  const nonce = BigInt(wordPos * 256 + bit);
  console.log(`Generated nonce: ${nonce} (wordPos: ${wordPos}, bit: ${bit})`);
  
  return nonce;
}

async function checkUserBalance() {
  const balance = await tokenContract.balanceOf(signer.address);
  console.log(`User WLD balance: ${ethers.formatUnits(balance, 18)} WLD`);
  
  if (balance < DEPOSIT_AMOUNT) {
    throw new Error(`Insufficient WLD balance. Need ${ethers.formatUnits(DEPOSIT_AMOUNT, 18)} WLD`);
  }
  
  return balance;
}

async function checkAndApprovePermit2() {
  console.log("Checking Permit2 allowance...");
  
  // Check current allowance for Permit2
  const allowance = await tokenContract.allowance(signer.address, PERMIT2_ADDRESS);
  console.log(`Current Permit2 allowance: ${ethers.formatUnits(allowance, 18)} WLD`);
  
  // If allowance is less than what we need, approve maximum amount
  if (allowance < DEPOSIT_AMOUNT) {
    console.log("Insufficient Permit2 allowance. Approving maximum amount...");
    
    // Approve maximum amount for Permit2 (this is safe and saves gas on future transactions)
    const maxApproval = ethers.MaxUint256;
    const approveTx = await tokenContract.approve(PERMIT2_ADDRESS, maxApproval);
    
    console.log("Approval transaction sent:", approveTx.hash);
    console.log("Waiting for approval confirmation...");
    
    const approvalReceipt = await approveTx.wait();
    console.log("Approval confirmed! Block:", approvalReceipt.blockNumber);
    
    // Verify the approval worked
    const newAllowance = await tokenContract.allowance(signer.address, PERMIT2_ADDRESS);
    console.log(`New Permit2 allowance: ${ethers.formatUnits(newAllowance, 18)} WLD`);
    
    return true;
  } else {
    console.log("✅ Permit2 allowance is sufficient");
    return false;
  }
}

async function createPermitSignature() {
  console.log("Creating Permit2 signature...");
  
  // Generate nonce from bitmap (similar to StakingMain.tsx)
  const nonce = await generateNonceFromBitmap();
  
  // Set deadline to 30 minutes from now (same as StakingMain.tsx)
  const deadline = Math.floor((Date.now() + 30 * 60 * 1000) / 1000);
  
  // Create permit data structure exactly like StakingMain.tsx
  const permitData = {
    permitted: {
      token: WLD_TOKEN_ADDRESS,
      amount: DEPOSIT_AMOUNT.toString()
    },
    spender: VAULT_MANAGER_ADDRESS,
    nonce: nonce.toString(),
    deadline: deadline.toString()
  };
  
  console.log("Permit data:", {
    token: permitData.permitted.token,
    amount: ethers.formatUnits(permitData.permitted.amount, 18),
    spender: permitData.spender,
    nonce: permitData.nonce,
    deadline: new Date(Number(permitData.deadline) * 1000).toISOString()
  });
  
  // Sign the permit using EIP-712
  const signature = await signer.signTypedData(
    PERMIT2_DOMAIN,
    PERMIT_TRANSFER_FROM_TYPES,
    permitData
  );
  
  console.log("Signature created:", signature);
  
  return { permitData, signature };
}

async function depositWithPermit2() {
  try {
    console.log("=== Starting Permit2 Deposit Process ===");
    console.log(`Depositing ${ethers.formatUnits(DEPOSIT_AMOUNT, 18)} WLD tokens`);
    console.log(`From: ${signer.address}`);
    console.log(`To Vault: ${VAULT_MANAGER_ADDRESS}`);
    
    // Check user balance
    await checkUserBalance();
    
    // Check and approve Permit2 if necessary
    await checkAndApprovePermit2();
    
    // Create permit signature
    const { permitData, signature } = await createPermitSignature();
    
    // Format permit data for contract call (convert strings to proper types)
    const formattedPermitData = {
      permitted: {
        token: permitData.permitted.token,
        amount: permitData.permitted.amount
      },
      nonce: permitData.nonce,
      deadline: permitData.deadline
    };
    
    console.log("Formatted permit data for contract:", formattedPermitData);
    
    console.log("\n=== Calling depositWithPermit2 ===");
    
    // Call depositWithPermit2 function
    const tx = await vaultManagerContract.depositWithPermit2(
      DEPOSIT_AMOUNT,
      formattedPermitData,
      signature
    );
    
    console.log("Transaction sent:", tx.hash);
    console.log("Waiting for confirmation...");
    
    const receipt = await tx.wait();
    
    console.log("\n=== Transaction Confirmed ===");
    console.log("Block number:", receipt.blockNumber);
    console.log("Gas used:", receipt.gasUsed.toString());
    
    // Parse events to get deposit information
    if (receipt.logs.length > 0) {
      console.log("\n=== Events Emitted ===");
      receipt.logs.forEach((log, index) => {
        console.log(`Log ${index}:`, log);
      });
    }
    
    console.log("\n✅ Deposit successful!");
    
  } catch (error) {
    console.error("\n❌ Deposit failed:");
    
    if (error.code === 'CALL_EXCEPTION') {
      console.error("Contract call failed:", error.reason || error.message);
    } else if (error.code === 'INSUFFICIENT_FUNDS') {
      console.error("Insufficient funds for gas");
    } else if (error.message.includes('Permit expired')) {
      console.error("Permit signature has expired");
    } else if (error.message.includes('Invalid signature')) {
      console.error("Invalid permit signature");
    } else {
      console.error("Error:", error.message);
    }
    
    if (error.data) {
      console.error("Error data:", error.data);
    }
  }
}

// Helper function to check nonce usage
async function checkNonceBitmap(user, wordPosition) {
  try {
    const bitmap = await permit2Contract.nonceBitmap(user, wordPosition);
    console.log(`Nonce bitmap for ${user} at position ${wordPosition}:`, bitmap.toString());
    return bitmap;
  } catch (error) {
    console.error("Error checking nonce bitmap:", error);
  }
}

// Main execution
async function main() {
  try {
    console.log("Connecting to World Chain mainnet...");
    console.log("Network:", await provider.getNetwork());
    console.log("Signer address:", signer.address);
    
    await depositWithPermit2();
    
  } catch (error) {
    console.error("Script failed:", error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = {
  depositWithPermit2,
  checkNonceBitmap,
  VAULT_MANAGER_ADDRESS,
  WLD_TOKEN_ADDRESS,
  PERMIT2_ADDRESS
}; 