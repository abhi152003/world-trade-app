const { ethers } = require("ethers");

// Contract addresses (update these with your deployed addresses)
const STAKING_TOKEN_ADDRESS = "0x006d5140bF5aa3eC08bb3F26Fa549FB14929eFCA";
const RPC_URL = "https://worldchain-sepolia.g.alchemy.com/v2/jnXGx1FQOwjGAoT1N8zGFZYozHAQ3L6C";

// Minimal ERC20Permit ABI
const ERC20_PERMIT_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function nonces(address owner) view returns (uint256)",
  "function DOMAIN_SEPARATOR() view returns (bytes32)",
  "function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s)"
];

async function verifyContract() {
  try {
    console.log("🔍 Verifying contract at:", STAKING_TOKEN_ADDRESS);
    console.log("🌐 Network: World Chain Sepolia");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    // Create provider
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    
    // Check if contract exists
    const code = await provider.getCode(STAKING_TOKEN_ADDRESS);
    if (code === "0x") {
      console.log("❌ No contract found at this address!");
      return;
    }
    console.log("✅ Contract exists");

    // Create contract instance
    const contract = new ethers.Contract(STAKING_TOKEN_ADDRESS, ERC20_PERMIT_ABI, provider);

    // Test basic ERC20 functions
    console.log("\n📋 Testing Basic ERC20 Functions:");
    try {
      const name = await contract.name();
      console.log("✅ name():", name);
    } catch (err) {
      console.log("❌ name() failed:", err.message);
    }

    try {
      const symbol = await contract.symbol();
      console.log("✅ symbol():", symbol);
    } catch (err) {
      console.log("❌ symbol() failed:", err.message);
    }

    try {
      const decimals = await contract.decimals();
      console.log("✅ decimals():", decimals.toString());
    } catch (err) {
      console.log("❌ decimals() failed:", err.message);
    }

    try {
      const totalSupply = await contract.totalSupply();
      console.log("✅ totalSupply():", ethers.formatEther(totalSupply), "tokens");
    } catch (err) {
      console.log("❌ totalSupply() failed:", err.message);
    }

    // Test permit functions
    console.log("\n🔐 Testing EIP-2612 Permit Functions:");
    
    // Test DOMAIN_SEPARATOR
    try {
      const domainSeparator = await contract.DOMAIN_SEPARATOR();
      console.log("✅ DOMAIN_SEPARATOR():", domainSeparator);
    } catch (err) {
      console.log("❌ DOMAIN_SEPARATOR() failed:", err.message);
    }

    // Test nonces with a test address
    try {
      const testAddress = "0x0000000000000000000000000000000000000001";
      const nonce = await contract.nonces(testAddress);
      console.log("✅ nonces():", nonce.toString());
    } catch (err) {
      console.log("❌ nonces() failed:", err.message);
    }

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🎉 Verification complete!");
    
  } catch (error) {
    console.error("❌ Verification failed:", error.message);
  }
}

// Run verification
verifyContract(); 