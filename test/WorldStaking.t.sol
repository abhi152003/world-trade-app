// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Test, console} from "forge-std/Test.sol";
import {WorldStaking, RewardToken} from "../src/WorldStaking.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// Mock ERC20 token for testing
contract MockStakingToken is ERC20 {
    constructor() ERC20("MockStaking", "MST") {
        _mint(msg.sender, 1_000_000 * 10**18); // Mint 1M tokens
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract WorldStakingTest is Test {
    WorldStaking public worldStaking;
    RewardToken public rewardToken;
    MockStakingToken public stakingToken;
    
    address public owner = address(this);
    address public user1 = address(0x1);
    address public user2 = address(0x2);
    
    uint256 public constant STAKE_AMOUNT = 1000 * 10**18; // 1000 tokens
    uint256 public constant TRADING_PERCENTAGE = 2;
    uint256 public constant LOCKIN_PERIOD = 10 minutes;
    
    function setUp() public {
        // Deploy contracts
        stakingToken = new MockStakingToken();
        rewardToken = new RewardToken();
        worldStaking = new WorldStaking(address(stakingToken), address(rewardToken));
        
        // Transfer ownership of reward token to staking contract
        rewardToken.transferOwnership(address(worldStaking));
        
        // Mint tokens to users
        stakingToken.mint(user1, STAKE_AMOUNT * 10);
        stakingToken.mint(user2, STAKE_AMOUNT * 10);
        
        // Give users approval allowance
        vm.prank(user1);
        stakingToken.approve(address(worldStaking), type(uint256).max);
        
        vm.prank(user2);
        stakingToken.approve(address(worldStaking), type(uint256).max);
    }
    
    function testStakeTokens() public {
        vm.prank(user1);
        worldStaking.stake(STAKE_AMOUNT);
        
        // Check stake details
        (
            uint256 amount,
            uint256 timestamp,
            uint256 tradingAmount,
            uint256 currentTradeValue,
            bool tradeActive,
            uint256 claimableRewards,
            bool active
        ) = worldStaking.getStakeDetails(user1, 0);
        
        assertEq(amount, STAKE_AMOUNT);
        assertEq(tradingAmount, (STAKE_AMOUNT * TRADING_PERCENTAGE) / 100);
        assertEq(currentTradeValue, tradingAmount);
        assertTrue(tradeActive);
        assertEq(claimableRewards, 0);
        assertTrue(active);
        
        // Check user balance decreased
        assertEq(stakingToken.balanceOf(user1), STAKE_AMOUNT * 10 - STAKE_AMOUNT);
    }
    
    function testCannotStakeZeroAmount() public {
        vm.prank(user1);
        vm.expectRevert("Amount must be greater than 0");
        worldStaking.stake(0);
    }
    
    function testCannotStakeWithoutSufficientBalance() public {
        vm.prank(user1);
        vm.expectRevert("Insufficient balance");
        worldStaking.stake(STAKE_AMOUNT * 100);
    }
    
    function testUpdateTradeValue() public {
        vm.prank(user1);
        worldStaking.stake(STAKE_AMOUNT);
        
        uint256 newTradeValue = 50 * 10**18; // 50 tokens profit
        worldStaking.updateTradeValue(user1, 0, newTradeValue);
        
        (,,, uint256 currentTradeValue,,,) = worldStaking.getStakeDetails(user1, 0);
        assertEq(currentTradeValue, newTradeValue);
    }
    
    function testExitTradeProfitable() public {
        vm.prank(user1);
        worldStaking.stake(STAKE_AMOUNT);
        
        uint256 originalTradingAmount = (STAKE_AMOUNT * TRADING_PERCENTAGE) / 100;
        uint256 finalTradeValue = originalTradingAmount + 10 * 10**18; // 10 tokens profit
        
        worldStaking.exitTrade(user1, 0, finalTradeValue);
        
        (,,, uint256 currentTradeValue, bool tradeActive, uint256 claimableRewards,) = 
            worldStaking.getStakeDetails(user1, 0);
            
        assertEq(currentTradeValue, finalTradeValue);
        assertFalse(tradeActive);
        assertEq(claimableRewards, 10 * 10**18); // Profit amount as rewards
    }
    
    function testExitTradeUnprofitable() public {
        vm.prank(user1);
        worldStaking.stake(STAKE_AMOUNT);
        
        uint256 originalTradingAmount = (STAKE_AMOUNT * TRADING_PERCENTAGE) / 100;
        uint256 finalTradeValue = originalTradingAmount - 5 * 10**18; // 5 tokens loss
        
        worldStaking.exitTrade(user1, 0, finalTradeValue);
        
        (,,, uint256 currentTradeValue, bool tradeActive, uint256 claimableRewards,) = 
            worldStaking.getStakeDetails(user1, 0);
            
        assertEq(currentTradeValue, finalTradeValue);
        assertFalse(tradeActive);
        assertEq(claimableRewards, 0); // No rewards for losses
    }
    
    function testUnstakeAfterLockinPeriod() public {
        vm.prank(user1);
        worldStaking.stake(STAKE_AMOUNT);
        
        // Exit trade first
        uint256 originalTradingAmount = (STAKE_AMOUNT * TRADING_PERCENTAGE) / 100;
        worldStaking.exitTrade(user1, 0, originalTradingAmount);
        
        // Move forward in time past lock-in period
        vm.warp(block.timestamp + LOCKIN_PERIOD + 1);
        
        uint256 balanceBefore = stakingToken.balanceOf(user1);
        
        vm.prank(user1);
        worldStaking.unstake(0);
        
        uint256 balanceAfter = stakingToken.balanceOf(user1);
        assertEq(balanceAfter - balanceBefore, STAKE_AMOUNT);
        
        // Check stake is no longer active
        (,,,,,, bool active) = worldStaking.getStakeDetails(user1, 0);
        assertFalse(active);
    }
    
    function testCannotUnstakeBeforeLockinPeriod() public {
        vm.prank(user1);
        worldStaking.stake(STAKE_AMOUNT);
        
        // Exit trade first
        uint256 originalTradingAmount = (STAKE_AMOUNT * TRADING_PERCENTAGE) / 100;
        worldStaking.exitTrade(user1, 0, originalTradingAmount);
        
        vm.prank(user1);
        vm.expectRevert("Lock-in period not over");
        worldStaking.unstake(0);
    }
    
    function testCannotUnstakeWithActiveTradeTest() public {
        vm.prank(user1);
        worldStaking.stake(STAKE_AMOUNT);
        
        // Move forward in time past lock-in period but don't exit trade
        vm.warp(block.timestamp + LOCKIN_PERIOD + 1);
        
        vm.prank(user1);
        vm.expectRevert("Trade must be exited first. Contact backend to exit trade.");
        worldStaking.unstake(0);
    }
    
    function testGetTotalClaimableRewards() public {
        vm.prank(user1);
        worldStaking.stake(STAKE_AMOUNT);
        
        vm.prank(user1);
        worldStaking.stake(STAKE_AMOUNT);
        
        // Exit both trades with profits
        uint256 originalTradingAmount = (STAKE_AMOUNT * TRADING_PERCENTAGE) / 100;
        worldStaking.exitTrade(user1, 0, originalTradingAmount + 10 * 10**18);
        worldStaking.exitTrade(user1, 1, originalTradingAmount + 15 * 10**18);
        
        uint256 totalRewards = worldStaking.getTotalClaimableRewards(user1);
        assertEq(totalRewards, 25 * 10**18); // 10 + 15 tokens profit
    }
    
    function testGetStakeCount() public {
        assertEq(worldStaking.getStakeCount(user1), 0);
        
        vm.prank(user1);
        worldStaking.stake(STAKE_AMOUNT);
        assertEq(worldStaking.getStakeCount(user1), 1);
        
        vm.prank(user1);
        worldStaking.stake(STAKE_AMOUNT);
        assertEq(worldStaking.getStakeCount(user1), 2);
    }
    
    function testCanUnstakeHelper() public {
        vm.prank(user1);
        worldStaking.stake(STAKE_AMOUNT);
        
        // Should not be able to unstake initially (lock-in period + active trade)
        assertFalse(worldStaking.canUnstake(user1, 0));
        
        // Exit trade
        uint256 originalTradingAmount = (STAKE_AMOUNT * TRADING_PERCENTAGE) / 100;
        worldStaking.exitTrade(user1, 0, originalTradingAmount);
        
        // Still can't unstake (lock-in period)
        assertFalse(worldStaking.canUnstake(user1, 0));
        
        // Move forward in time
        vm.warp(block.timestamp + LOCKIN_PERIOD + 1);
        
        // Now should be able to unstake
        assertTrue(worldStaking.canUnstake(user1, 0));
    }
    
    function testApproveTokensForStaking() public {
        uint256 approvalAmount = 1000 * 10**18;
        
        // Create a new user without pre-existing approval
        address user3 = address(0x3);
        stakingToken.mint(user3, STAKE_AMOUNT * 10);
        
        // User should approve tokens directly on the token contract
        vm.prank(user3);
        stakingToken.approve(address(worldStaking), approvalAmount);
        
        uint256 allowance = worldStaking.getAllowance(user3);
        assertEq(allowance, approvalAmount);
    }
    
    function testGetDayOfWeek() public {
        // Test current day of week calculation
        uint256 dayOfWeek = worldStaking.getDayOfWeek();
        assertTrue(dayOfWeek >= 0 && dayOfWeek <= 6);
    }
    
    function testOnlyOwnerFunctions() public {
        vm.prank(user1);
        worldStaking.stake(STAKE_AMOUNT);
        
        // Test updateTradeValue requires owner
        vm.prank(user1);
        vm.expectRevert();
        worldStaking.updateTradeValue(user1, 0, 100);
        
        // Test exitTrade requires owner
        vm.prank(user1);
        vm.expectRevert();
        worldStaking.exitTrade(user1, 0, 100);
    }
} 