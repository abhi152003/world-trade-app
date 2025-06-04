# World Trade Staking Contract

A Solidity smart contract for staking tokens with automated trading features and reward distribution.

## Overview

The WorldStaking contract allows users to:
- Stake ERC20 tokens with a 10-minute lock-in period
- Automatically allocate 2% of staked amount for trading
- Earn rewards based on trading profits
- Claim rewards only on Sundays after the lock-in period
- Unstake tokens after trades are exited and lock-in period expires

## Project Structure

```
world-trade-app/
├── src/
│   ├── WorldStaking.sol    # Main staking contract
│   └── Counter.sol         # Example contract (can be removed)
├── test/
│   ├── WorldStaking.t.sol  # Comprehensive tests
│   └── Counter.t.sol       # Example tests (can be removed)
├── script/
│   └── Deploy.s.sol        # Deployment script
├── lib/                    # Dependencies
│   ├── forge-std/          # Foundry standard library
│   └── openzeppelin-contracts/  # OpenZeppelin contracts
├── foundry.toml            # Foundry configuration
└── README.md               # This file
```

## Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation)
- Git

## Setup

1. **Clone and navigate to the project:**
   ```bash
   cd world-trade-app
   ```

2. **Install dependencies:**
   ```bash
   forge install
   ```

3. **Build the project:**
   ```bash
   forge build
   ```

## Testing

Run all tests:
```bash
forge test
```

Run tests with verbosity:
```bash
forge test -vv
```

Run specific test:
```bash
forge test --match-test testStakeTokens
```

Run tests with gas reports:
```bash
forge test --gas-report
```

## Contract Features

### Core Functions

1. **Staking:**
   - `stake(uint256 amount)` - Stake tokens
   - `unstake(uint256 index)` - Unstake specific stake after conditions are met

2. **Trading Management (Owner Only):**
   - `updateTradeValue(address user, uint256 stakeIndex, uint256 newTradeValue)` - Update trade values
   - `exitTrade(address user, uint256 stakeIndex, uint256 finalTradeValue)` - Exit trades and calculate rewards

3. **Reward Claims:**
   - `claimRewards()` - Claim all available rewards (Sundays only)

4. **View Functions:**
   - `getStakeDetails(address user, uint256 index)` - Get stake information
   - `getTotalClaimableRewards(address user)` - Get total claimable rewards
   - `canUnstake(address user, uint256 index)` - Check if unstaking is possible
   - `canClaimRewards(address user)` - Check if reward claiming is possible

### Constants

- **Lock-in Period:** 10 minutes (for testing)
- **Trading Percentage:** 2% of staked amount
- **Reward Claims:** Only on Sundays

## Deployment

### Local Deployment (Anvil)

1. **Start local blockchain:**
   ```bash
   anvil
   ```

2. **Deploy contracts:**
   ```bash
   forge script script/Deploy.s.sol:DeployScript --fork-url http://localhost:8545 --private-key --broadcast
```

### Testnet Deployment

1. **Set environment variables:**
   ```bash
   export PRIVATE_KEY=your_private_key_here
   export RPC_URL=your_rpc_url_here
   ```

2. **Deploy to testnet:**
   ```bash
   forge script script/Deploy.s.sol:DeployScript --rpc-url $RPC_URL --private-key $PRIVATE_KEY --broadcast --verify
   ```

## Usage Example

```solidity
// 1. Deploy contracts
StakingToken stakingToken = new StakingToken();
RewardToken rewardToken = new RewardToken();
WorldStaking worldStaking = new WorldStaking(address(stakingToken), address(rewardToken));

// 2. Transfer reward token ownership
rewardToken.transferOwnership(address(worldStaking));

// 3. User approves tokens
stakingToken.approve(address(worldStaking), amount);

// 4. User stakes tokens
worldStaking.stake(1000 * 10**18);

// 5. Backend updates trade values
worldStaking.updateTradeValue(user, 0, newValue);

// 6. Backend exits trade when needed
worldStaking.exitTrade(user, 0, finalValue);

// 7. User claims rewards on Sunday
worldStaking.claimRewards();

// 8. User unstakes after lock-in period
worldStaking.unstake(0);
```

## Security Considerations

- Only the contract owner can update trade values and exit trades
- Users must wait for the lock-in period before unstaking
- Trades must be exited before unstaking is possible
- Reward claims are restricted to Sundays only
- All functions include proper validation and error handling

## Development

### Adding New Tests

Create test functions in `test/WorldStaking.t.sol` following the existing pattern:

```solidity
function testNewFeature() public {
    // Setup
    vm.prank(user1);
    worldStaking.stake(STAKE_AMOUNT);
    
    // Action
    // ... your test logic
    
    // Assertions
    assertTrue(condition);
    assertEq(expected, actual);
}
```

### Code Quality

This project follows Clean Code Principles:
- Meaningful function and variable names
- Single responsibility functions
- Descriptive comments explaining intent
- Minimal function parameters
- Self-explanatory code structure

## License

MIT License
