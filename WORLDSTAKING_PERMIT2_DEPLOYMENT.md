# WorldStaking Permit2 Deployment Guide

This guide explains how to deploy the WorldStaking contract with Permit2 integration to World Chain Sepolia testnet.

## Overview

The WorldStaking Permit2 contract is an advanced staking system that integrates with Permit2 for gasless token approvals. It supports both traditional approve+stake and signature-based staking methods, providing users with flexible options for interacting with the contract.

### Key Features
- **Dual Staking Methods**: Traditional and Permit2-based staking
- **Trading Integration**: 2% of staked tokens are used for automated trading
- **Reward System**: Profitable trades generate rewards claimable on Sundays
- **Lock-in Period**: 10 minutes for testing (configurable)
- **Gas-Efficient**: Permit2 integration reduces gas costs for users

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

## Contract Architecture

### Deployed Contracts
1. **StakingToken (WST)**: ERC20 token used for staking
2. **RewardToken (RWD)**: ERC20 token distributed as rewards
3. **WorldStaking**: Main staking contract with Permit2 integration

### Dependencies
- **Permit2**: Universal contract at `0x000000000022D473030F116dDEE9F6B43aC78BA3`
- **Solmate**: Gas-optimized smart contract library

## Deployment Methods

### Method 1: Using the Shell Script (Recommended)
```bash
# Make sure you're in the project root
cd world-trade-app

# Set environment variables
export PRIVATE_KEY="your_private_key_here"

# Run the deployment script
./scripts/deploy-world-staking-permit2.sh
```

### Method 2: Using Forge Directly
```bash
# Build the contracts
forge build

# Deploy to World Chain Sepolia
forge script script/DeployWorldStakingPermit2.s.sol:DeployWorldStakingPermit2Script \
    --rpc-url world_chain_sepolia \
    --broadcast \
    --verify \
    --slow
```

## Post-Deployment

### Contract Verification
The deployment script automatically attempts to verify contracts. If verification fails, you can manually verify:

```bash
# Verify StakingToken
forge verify-contract <STAKING_TOKEN_ADDRESS> script/DeployWorldStakingPermit2.s.sol:StakingToken --chain world_chain_sepolia

# Verify RewardToken
forge verify-contract <REWARD_TOKEN_ADDRESS> src/WorldStakingPermit2.sol:RewardToken --chain world_chain_sepolia

# Verify WorldStaking (requires constructor args)
forge verify-contract <WORLD_STAKING_ADDRESS> src/WorldStakingPermit2.sol:WorldStaking --chain world_chain_sepolia --constructor-args $(cast abi-encode "constructor(address,address)" <STAKING_TOKEN_ADDRESS> <REWARD_TOKEN_ADDRESS>)
```

### Frontend Integration
After successful deployment, update your frontend configuration:

```javascript
// Contract addresses
const STAKING_TOKEN_ADDRESS = "0x..."; // From deployment output
const REWARD_TOKEN_ADDRESS = "0x...";  // From deployment output
const WORLD_STAKING_ADDRESS = "0x..."; // From deployment output
const PERMIT2_ADDRESS = "0x000000000022D473030F116dDEE9F6B43aC78BA3"; // Universal

// ABI files will be in out/ directory after compilation
```

### Testing the Deployment
```bash
# Check if contracts are deployed
cast code <CONTRACT_ADDRESS> --rpc-url world_chain_sepolia

# Check staking token balance of deployer
cast call <STAKING_TOKEN_ADDRESS> "balanceOf(address)" <DEPLOYER_ADDRESS> --rpc-url world_chain_sepolia
```

## Contract Functions

### Staking Methods

#### Traditional Staking
```solidity
// 1. Approve staking contract
stakingToken.approve(worldStakingAddress, amount);

// 2. Stake tokens
worldStaking.stake(amount);
```

#### Permit2 Staking (Gasless Approval)
```solidity
// 1. User signs permit message off-chain
// 2. Submit permit + signature to stake
worldStaking.stakeWithPermit2(amount, permitData, signature);
```

### Key Functions
- `stake(uint256 amount)` - Traditional staking method
- `stakeWithPermit2(uint256, PermitTransferFrom, bytes)` - Permit2-based staking
- `unstake(uint256 index)` - Unstake tokens after lock-in period
- `claimRewards()` - Claim rewards (Sundays only)
- `updateTradeValue(address, uint256, uint256)` - Update trade values (owner only)
- `exitTrade(address, uint256, uint256)` - Exit trades (owner only)

## Network Information

- **Network**: World Chain Sepolia Testnet
- **Chain ID**: 4801
- **RPC URL**: `https://worldchain-sepolia.g.alchemy.com/public`
- **Explorer**: `https://worldchain-sepolia.explorer.alchemy.com`

## Staking Workflow

### For Users
1. **Get Staking Tokens**: Receive WST tokens from deployer or faucet
2. **Choose Staking Method**:
   - Traditional: Approve + stake
   - Permit2: Sign message + stake with signature
3. **Wait for Trading**: 2% of stake enters automated trading
4. **Monitor Performance**: Track trade values via contract calls
5. **Unstake**: After 10-minute lock-in (trade must be exited first)
6. **Claim Rewards**: On Sundays, claim profitable trade rewards

### For Backend
1. **Monitor Stakes**: Track active trades via events
2. **Update Trade Values**: Call `updateTradeValue()` with market data
3. **Exit Trades**: Call `exitTrade()` when conditions are met
4. **Reward Calculation**: Profitable trades generate claimable rewards

## Troubleshooting

### Common Issues

1. **Build Failures**
   - Ensure Solmate is installed: `forge install transmissions11/solmate --no-commit`
   - Check foundry.toml has correct remappings

2. **Deployment Failures**
   - Verify private key is set correctly
   - Ensure wallet has sufficient ETH for gas
   - Check network connectivity

3. **Permit2 Issues**
   - Verify Permit2 contract exists at expected address
   - Ensure proper signature formatting
   - Check nonce usage and deadlines

4. **Verification Failures**
   - Wait a few minutes after deployment
   - Use exact contract paths and constructor args
   - Check if contracts are already verified

### Getting Help
- Review deployment logs for specific errors
- Check [Foundry documentation](https://book.getfoundry.sh/)
- Examine [World Chain documentation](https://docs.worldcoin.org/)

## Security Considerations

- ⚠️ **Private Key Security**: Never commit private keys to version control
- ⚠️ **Permit2 Signatures**: Validate all signature parameters carefully
- ⚠️ **Owner Functions**: Only contract owner can update trade values
- ⚠️ **Testing**: Thoroughly test on testnet before mainnet deployment

## Advanced Usage

### Permit2 Integration Details
The contract uses Permit2's signature-based transfer mechanism:
- Users sign permit messages off-chain
- No need for separate approval transactions
- Supports nonce-based replay protection
- Compatible with all ERC20 tokens

### Backend Integration
For production use, implement backend services to:
- Monitor blockchain events for new stakes
- Fetch real-time trading data
- Update trade values periodically
- Execute trade exits based on strategy
- Notify users of reward availability

## Next Steps

After successful deployment:
1. **Save Contract Addresses**: Store all deployed addresses securely
2. **Update Frontend**: Integrate contract addresses and ABIs
3. **Test Functionality**: Verify both staking methods work
4. **Backend Setup**: Implement trade monitoring and management
5. **User Documentation**: Create guides for end users
6. **Monitoring**: Set up alerts for contract events and performance 