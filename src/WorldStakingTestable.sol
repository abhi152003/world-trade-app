// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

// Reward Token Contract
contract RewardTokenTestable is ERC20, Ownable {
    constructor() ERC20("RewardTokenTestable", "RWDT") Ownable(msg.sender) {
        _mint(msg.sender, 1_000_000 * 10**18); // Mint 1M tokens to owner
    }

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}

// Staking Token with Permit functionality
contract StakingTokenTestable is ERC20Permit {
    constructor() ERC20("World Staking Token Testable", "WSTT") ERC20Permit("World Staking Token Testable") {
        _mint(msg.sender, 1_000_000 * 10**18); // Mint 1M tokens to deployer
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

// Testable Staking Contract (No Sunday restriction)
contract WorldStakingTestable is Ownable {
    IERC20 public stakingToken; // Token for staking (STK)
    RewardTokenTestable public rewardToken; // Reward token for distribution

    uint256 public constant LOCKIN_PERIOD = 10 minutes; // 10 minutes for testing
    uint256 public constant SECONDS_IN_DAY = 1 days;
    uint256 public constant TRADING_PERCENTAGE = 2; // 2% of staked amount is traded

    struct Stake {
        uint256 amount; // Amount of tokens staked
        uint256 timestamp; // When the stake was made
        uint256 tradingAmount; // 2% of staked amount used for trading
        uint256 currentTradeValue; // Current value of the trade (initially same as tradingAmount)
        bool tradeActive; // Whether there's an active trade
        uint256 claimableRewards; // Rewards available for claiming
        bool active; // Whether the stake is active
    }

    mapping(address => Stake[]) public stakes; // User stakes as an array

    event Staked(address indexed user, uint256 amount, uint256 tradingAmount, uint256 timestamp);
    event StakedWithPermit(address indexed user, uint256 amount, uint256 tradingAmount, uint256 timestamp);
    event Unstaked(address indexed user, uint256 amount, uint256 rewards, uint256 timestamp);
    event RewardsClaimed(address indexed user, uint256 amount, uint256 timestamp);
    event TradeUpdated(address indexed user, uint256 stakeIndex, uint256 newTradeValue);
    event TradeExited(address indexed user, uint256 stakeIndex, uint256 finalValue, uint256 rewards);
    event TokensApproved(address indexed user, uint256 amount);

    constructor(address _stakingToken, address _rewardToken) Ownable(msg.sender) {
        stakingToken = IERC20(_stakingToken);
        rewardToken = RewardTokenTestable(_rewardToken);
    }

    // Approve tokens for staking
    function approveTokensForStaking(uint256 amount) external {
        require(amount > 0, "Amount must be greater than 0");
        require(stakingToken.approve(address(this), amount), "Approval failed");
        emit TokensApproved(msg.sender, amount);
    }

    // Check allowance for a user
    function getAllowance(address user) external view returns (uint256) {
        return stakingToken.allowance(user, address(this));
    }

    // Check balance of staking tokens for a user
    function getStakingTokenBalance(address user) external view returns (uint256) {
        return stakingToken.balanceOf(user);
    }

    // Stake tokens (traditional way with pre-approval)
    function stake(uint256 amount) external {
        require(amount > 0, "Amount must be greater than 0");
        require(stakingToken.balanceOf(msg.sender) >= amount, "Insufficient balance");
        require(stakingToken.allowance(msg.sender, address(this)) >= amount, "Insufficient allowance. Call approveTokensForStaking first");

        require(stakingToken.transferFrom(msg.sender, address(this), amount), "Transfer failed");

        uint256 tradingAmount = (amount * TRADING_PERCENTAGE) / 100;

        stakes[msg.sender].push(Stake({
            amount: amount,
            timestamp: block.timestamp,
            tradingAmount: tradingAmount,
            currentTradeValue: tradingAmount,
            tradeActive: true,
            claimableRewards: 0,
            active: true
        }));

        emit Staked(msg.sender, amount, tradingAmount, block.timestamp);
    }

    // Stake tokens with permit (single transaction!)
    function stakeWithPermit(
        uint256 amount,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        require(amount > 0, "Amount must be greater than 0");
        require(stakingToken.balanceOf(msg.sender) >= amount, "Insufficient balance");

        // Use permit to approve tokens and then stake in one transaction
        try ERC20Permit(address(stakingToken)).permit(
            msg.sender,
            address(this),
            amount,
            deadline,
            v,
            r,
            s
        ) {} catch {
            // Permit might fail if signature is already used or invalid
            // Still check if we have enough allowance to proceed
            require(
                stakingToken.allowance(msg.sender, address(this)) >= amount,
                "Permit failed and insufficient allowance"
            );
        }

        require(stakingToken.transferFrom(msg.sender, address(this), amount), "Transfer failed");

        uint256 tradingAmount = (amount * TRADING_PERCENTAGE) / 100;

        stakes[msg.sender].push(Stake({
            amount: amount,
            timestamp: block.timestamp,
            tradingAmount: tradingAmount,
            currentTradeValue: tradingAmount,
            tradeActive: true,
            claimableRewards: 0,
            active: true
        }));

        emit StakedWithPermit(msg.sender, amount, tradingAmount, block.timestamp);
    }

    // Update trade value (called by backend when trade price changes)
    function updateTradeValue(address user, uint256 stakeIndex, uint256 newTradeValue) external onlyOwner {
        require(stakeIndex < stakes[user].length, "Invalid stake index");
        Stake storage userStake = stakes[user][stakeIndex];
        require(userStake.active, "Stake not active");
        require(userStake.tradeActive, "Trade not active");

        userStake.currentTradeValue = newTradeValue;
        emit TradeUpdated(user, stakeIndex, newTradeValue);
    }

    // Exit trade (called by backend when max exit time is reached or user unstakes)
    function exitTrade(address user, uint256 stakeIndex, uint256 finalTradeValue) external onlyOwner {
        require(stakeIndex < stakes[user].length, "Invalid stake index");
        Stake storage userStake = stakes[user][stakeIndex];
        require(userStake.active, "Stake not active");
        require(userStake.tradeActive, "Trade not active");

        userStake.currentTradeValue = finalTradeValue;
        userStake.tradeActive = false;

        // Calculate rewards: if trade is profitable, reward = profit amount
        if (finalTradeValue > userStake.tradingAmount) {
            userStake.claimableRewards = finalTradeValue - userStake.tradingAmount;
        }

        emit TradeExited(user, stakeIndex, finalTradeValue, userStake.claimableRewards);
    }

    // Unstake tokens by index
    function unstake(uint256 index) external {
        require(index < stakes[msg.sender].length, "Invalid stake index");
        Stake storage userStake = stakes[msg.sender][index];
        require(userStake.active, "No active stake");
        require(block.timestamp >= userStake.timestamp + LOCKIN_PERIOD, "Lock-in period not over");

        uint256 amount = userStake.amount;
        uint256 rewards = userStake.claimableRewards;

        // If trade is still active, it needs to be exited by backend first
        require(!userStake.tradeActive, "Trade must be exited first. Contact backend to exit trade.");

        // Preserve the original timestamp and claimable rewards for claiming later
        // Only reset amount and set active to false
        userStake.amount = 0;
        userStake.active = false;
        // Keep timestamp, claimableRewards, tradingAmount, and currentTradeValue for history

        require(stakingToken.transfer(msg.sender, amount), "Transfer failed");

        emit Unstaked(msg.sender, amount, rewards, block.timestamp);
    }

    // Claim rewards (TESTABLE VERSION - No Sunday restriction!)
    function claimRewards() external {
        uint256 totalRewards = 0;
        bool hasClaimableRewards = false;
        uint256 earliestTimestamp = type(uint256).max;

        // Calculate total claimable rewards and find earliest stake (including inactive stakes with rewards)
        for (uint256 i = 0; i < stakes[msg.sender].length; i++) {
            if (stakes[msg.sender][i].claimableRewards > 0) {
                hasClaimableRewards = true;
                totalRewards += stakes[msg.sender][i].claimableRewards;
                if (stakes[msg.sender][i].timestamp < earliestTimestamp) {
                    earliestTimestamp = stakes[msg.sender][i].timestamp;
                }
            }
        }

        require(hasClaimableRewards, "No rewards to claim");
        require(block.timestamp >= earliestTimestamp + LOCKIN_PERIOD, "Lock-in period not over");

        // NO SUNDAY CHECK - Can claim any day!
        // This makes testing much easier

        // Reset claimable rewards for all stakes that have rewards
        for (uint256 i = 0; i < stakes[msg.sender].length; i++) {
            if (stakes[msg.sender][i].claimableRewards > 0) {
                stakes[msg.sender][i].claimableRewards = 0;
            }
        }

        rewardToken.mint(msg.sender, totalRewards);
        emit RewardsClaimed(msg.sender, totalRewards, block.timestamp);
    }

    // Helper function to get the current day of the week (0 = Sunday)
    function getDayOfWeek() external view returns (uint256) {
        return (block.timestamp / SECONDS_IN_DAY) % 7;
    }

    // Helper function to check if a user can unstake a specific stake
    function canUnstake(address user, uint256 index) external view returns (bool) {
        if (index >= stakes[user].length) return false;
        Stake storage userStake = stakes[user][index];
        return userStake.active && 
               block.timestamp >= userStake.timestamp + LOCKIN_PERIOD &&
               !userStake.tradeActive; // Trade must be exited first
    }

    // Helper function to check if a user can claim rewards (TESTABLE VERSION - No Sunday check!)
    function canClaimRewards(address user) external view returns (bool) {
        bool hasClaimableRewards = false;
        uint256 earliestTimestamp = type(uint256).max;

        for (uint256 i = 0; i < stakes[user].length; i++) {
            if (stakes[user][i].claimableRewards > 0) {
                hasClaimableRewards = true;
                if (stakes[user][i].timestamp < earliestTimestamp) {
                    earliestTimestamp = stakes[user][i].timestamp;
                }
            }
        }

        if (!hasClaimableRewards) return false;
        if (block.timestamp < earliestTimestamp + LOCKIN_PERIOD) return false;

        // NO SUNDAY CHECK - Can claim any day after lock-in period!
        return true;
    }

    // Get stake details for a user
    function getStakeDetails(address user, uint256 index) external view returns (
        uint256 amount,
        uint256 timestamp,
        uint256 tradingAmount,
        uint256 currentTradeValue,
        bool tradeActive,
        uint256 claimableRewards,
        bool active
    ) {
        require(index < stakes[user].length, "Invalid stake index");
        Stake storage userStake = stakes[user][index];
        return (
            userStake.amount,
            userStake.timestamp,
            userStake.tradingAmount,
            userStake.currentTradeValue,
            userStake.tradeActive,
            userStake.claimableRewards,
            userStake.active
        );
    }

    // Get total claimable rewards for a user
    function getTotalClaimableRewards(address user) external view returns (uint256) {
        uint256 totalRewards = 0;
        for (uint256 i = 0; i < stakes[user].length; i++) {
            totalRewards += stakes[user][i].claimableRewards;
        }
        return totalRewards;
    }

    // Get number of stakes for a user
    function getStakeCount(address user) external view returns (uint256) {
        return stakes[user].length;
    }
} 