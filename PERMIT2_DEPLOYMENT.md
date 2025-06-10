# Permit2 Deployment Guide

This guide explains how to deploy the Permit2 contract to World Chain Sepolia testnet.

## Overview

Permit2 is a token approval contract that enables signature-based and allowance-based token transfers. Since there's no existing Permit2 contract on World Chain Sepolia testnet, this deployment script provides the necessary infrastructure.

## Prerequisites

### Required Tools
- [Foundry](https://book.getfoundry.sh/getting-started/installation) (forge, anvil, cast)
- Node.js and npm (for frontend integration)

### Required Environment Variables
```bash
export PRIVATE_KEY="your_private_key_here"
```

### Getting Your Private Key
**Private Key**: Export from your wallet (MetaMask, etc.) - ensure it has ETH tokens for gas on World Chain Sepolia

**Note**: No API key is required as we use the public RPC endpoint for World Chain Sepolia.

## Deployment Methods

### Method 1: Using the Shell Script (Recommended)
```bash
# Make sure you're in the project root
cd world-trade-app

# Set environment variables
export PRIVATE_KEY="your_private_key_here"

# Run the deployment script
./scripts/deploy-permit2.sh
```

### Method 2: Using Forge Directly
```bash
# Build the contracts
forge build

# Deploy to World Chain Sepolia
forge script script/DeployPermit2.s.sol:DeployPermit2Script \
    --rpc-url world_chain_sepolia \
    --broadcast \
    --verify \
    --slow
```

## Post-Deployment

### Contract Verification
The deployment script automatically attempts to verify the contract. If verification fails, you can manually verify using:

```bash
forge verify-contract <CONTRACT_ADDRESS> src/permit2/Permit2.sol:Permit2 --chain world_chain_sepolia
```

### Frontend Integration
After successful deployment, update your frontend configuration with the deployed address:

```javascript
// In your frontend configuration
const PERMIT2_ADDRESS = "0x..."; // Address from deployment output
```

### Testing the Deployment
You can test the deployed contract using cast:

```bash
# Check if contract is deployed
cast code <CONTRACT_ADDRESS> --rpc-url world_chain_sepolia

# Should return non-empty bytecode if deployment was successful
```

## Contract Details

### Permit2 Contract Features
- **Signature-based transfers**: Users can transfer tokens using signatures instead of direct approvals
- **Allowance-based transfers**: Traditional allowance mechanism with enhanced security
- **Gas-efficient**: Optimized for minimal gas consumption
- **No initialization required**: Contract is ready to use immediately after deployment

### Network Information
- **Network**: World Chain Sepolia Testnet
- **Chain ID**: 4801
- **RPC URL**: `https://worldchain-sepolia.g.alchemy.com/public`

## Troubleshooting

### Common Issues

1. **Gas Estimation Failed**
   - Ensure your wallet has sufficient WLD tokens
   - Try increasing gas limit in the script

2. **RPC Connection Issues**
   - Check network connectivity
   - Verify you're using the correct public RPC endpoint

3. **Verification Failed**
   - Wait a few minutes and try manual verification
   - Ensure the contract source matches exactly

4. **Permission Denied (Shell Script)**
   - Run: `chmod +x scripts/deploy-permit2.sh`

### Getting Help
- Check the [Foundry documentation](https://book.getfoundry.sh/)
- Review the [World Chain documentation](https://docs.worldcoin.org/)
- Examine deployment logs for specific error messages

## Security Notes

- ⚠️ **Never commit private keys to version control**
- ⚠️ **Use environment variables for sensitive data**
- ⚠️ **Test on testnet before mainnet deployment**
- ⚠️ **Verify contract source code after deployment**

## Next Steps

After successful deployment:
1. Save the contract address securely
2. Update your frontend application configuration
3. Test token approvals and transfers
4. Monitor contract usage and performance 