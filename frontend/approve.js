const { ethers } = require("ethers");
const dotenv = require("dotenv");
dotenv.config();

// === CONFIGURATION ===
const tokenAddress = "0xaa046e335e07784f72b8c66d1666129bd8388369";         // ERC-20 token contract
const spenderAddress = "0x87e09e6490A528fD722aA6F6254CED1796F36bb8";      // Smart contract that will spend tokens
const amount = ethers.parseUnits("100", 18);      // Amount to approve (adjust decimals if needed)

// Your wallet's private key (be careful with this!)
const privateKey = process.env.PRIVATE_KEY;

// World Chain Sepolia RPC URL
const provider = new ethers.JsonRpcProvider("https://worldchain-sepolia.g.alchemy.com/public");

// Create signer from private key
const signer = new ethers.Wallet(privateKey, provider);

// ERC20 ABI (only approve function needed)
const erc20Abi = [
  "function approve(address spender, uint256 amount) public returns (bool)"
];

// Connect to the token contract
const tokenContract = new ethers.Contract(tokenAddress, erc20Abi, signer);

async function approveToken() {
  try {
    const tx = await tokenContract.approve(spenderAddress, amount);
    console.log("Transaction sent:", tx.hash);

    const receipt = await tx.wait();
    console.log("Transaction confirmed:", receipt);
  } catch (err) {
    console.error("Approval failed:", err);
  }
}

approveToken();