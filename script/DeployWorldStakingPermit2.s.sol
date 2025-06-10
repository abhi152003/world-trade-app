// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Script, console} from "forge-std/Script.sol";
import {WorldStaking, RewardToken} from "../src/WorldStakingPermit2.sol";
import {ERC20} from "@solmate/tokens/ERC20.sol";

/**
 * @title StakingToken
 * @notice Mock ERC20 token for staking purposes on World Chain Sepolia
 * @dev This is a test token for the WorldStaking contract
 */
contract StakingToken is ERC20 {
    constructor() ERC20("World Staking Token", "WST", 18) {
        _mint(msg.sender, 1_000_000 * 10**18); // Mint 1M tokens to deployer
    }

    /**
     * @notice Mint tokens to specified address
     * @param to Address to mint tokens to
     * @param amount Amount of tokens to mint
     */
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/**
 * @title DeployWorldStakingPermit2Script
 * @notice Deployment script for WorldStaking contract with Permit2 integration on World Chain Sepolia
 * @dev This script deploys the complete staking ecosystem including tokens and main contract
 */
contract DeployWorldStakingPermit2Script is Script {
    
    /// @notice Deployed contract addresses
    address public stakingTokenAddress;
    address public rewardTokenAddress;
    address public worldStakingAddress;
    
    /// @notice Permit2 contract address (universal deployment)
    address private constant PERMIT2_ADDRESS = 0xFB8e062817CDBed024c00eC2E351060A1f6C4ae2;
    
    /// @notice Initial token amounts for testing
    uint256 private constant INITIAL_STAKING_TOKENS = 100_000 * 10**18; // 100k tokens for deployer
    
    function setUp() public {}

    /**
     * @notice Main deployment function
     * @dev Deploys staking token, reward token, and WorldStaking contract with proper setup
     */
    function run() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        _logDeploymentStart(deployer);
        
        vm.startBroadcast(deployerPrivateKey);

        // Deploy staking token
        StakingToken stakingToken = new StakingToken();
        stakingTokenAddress = address(stakingToken);
        console.log("StakingToken deployed at:", stakingTokenAddress);

        // Deploy reward token
        RewardToken rewardToken = new RewardToken();
        rewardTokenAddress = address(rewardToken);
        console.log("RewardToken deployed at:", rewardTokenAddress);

        // Deploy WorldStaking contract with Permit2 integration
        WorldStaking worldStaking = new WorldStaking(
            stakingTokenAddress,
            rewardTokenAddress
        );
        worldStakingAddress = address(worldStaking);
        console.log("WorldStaking deployed at:", worldStakingAddress);

        // Transfer ownership of reward token to staking contract
        rewardToken.transferOwnership(worldStakingAddress);
        console.log("RewardToken ownership transferred to WorldStaking");

        // Mint initial tokens to deployer for testing
        stakingToken.mint(deployer, INITIAL_STAKING_TOKENS);
        console.log("Minted initial staking tokens to deployer");

        vm.stopBroadcast();

        _logDeploymentSummary(deployer);
        _logPermit2Integration();
        _logNextSteps();
    }

    /**
     * @notice Logs deployment start information
     * @param deployer Address that will deploy the contracts
     */
    function _logDeploymentStart(address deployer) private pure {
        console.log("=== WORLD STAKING PERMIT2 DEPLOYMENT STARTING ===");
        console.log("Deployer address:", deployer);
        console.log("Network: World Chain Sepolia Testnet");
        console.log("Permit2 address:", PERMIT2_ADDRESS);
    }

    /**
     * @notice Logs comprehensive deployment summary
     * @param deployer Address that deployed the contracts
     */
    function _logDeploymentSummary(address deployer) private view {
        console.log("\n=== DEPLOYMENT SUMMARY ===");
        console.log("Network: World Chain Sepolia Testnet (Chain ID: 4801)");
        console.log("StakingToken (WST):", stakingTokenAddress);
        console.log("RewardToken (RWD):", rewardTokenAddress);
        console.log("WorldStaking:", worldStakingAddress);
        console.log("Deployer:", deployer);
        console.log("Block:", block.number);
        console.log("Timestamp:", block.timestamp);
        
        console.log("\n=== FRONTEND INTEGRATION ===");
        console.log("Add these contract addresses to your frontend:");
        console.log("STAKING_TOKEN_ADDRESS=", stakingTokenAddress);
        console.log("REWARD_TOKEN_ADDRESS=", rewardTokenAddress);
        console.log("WORLD_STAKING_ADDRESS=", worldStakingAddress);
        console.log("PERMIT2_ADDRESS=", PERMIT2_ADDRESS);
    }

    /**
     * @notice Logs Permit2 integration information
     */
    function _logPermit2Integration() private pure {
        console.log("\n=== PERMIT2 INTEGRATION ===");
        console.log("This contract supports two staking methods:");
        console.log("1. Legacy: approve() + stake() - traditional method");
        console.log("2. Permit2: stakeWithPermit2() - gasless approval with signatures");
        console.log("Permit2 Contract:", PERMIT2_ADDRESS);
        console.log("Note: Users must approve Permit2 for staking token before using stakeWithPermit2()");
    }

    /**
     * @notice Logs next steps and usage instructions
     */
    function _logNextSteps() private view {
        console.log("\n=== NEXT STEPS ===");
        console.log("1. Verify contracts on block explorer");
        console.log("2. Update frontend with deployed addresses");
        console.log("3. Test staking functionality with both methods");
        console.log("4. Set up backend for trade value updates");
        
        console.log("\n=== VERIFICATION COMMANDS ===");
        console.log("forge verify-contract", stakingTokenAddress, "script/DeployWorldStakingPermit2.s.sol:StakingToken --chain world_chain_sepolia");
        console.log("forge verify-contract", rewardTokenAddress, "src/WorldStakingPermit2.sol:RewardToken --chain world_chain_sepolia");
        console.log("For WorldStaking verification, use:");
        console.log("forge verify-contract", worldStakingAddress, "src/WorldStakingPermit2.sol:WorldStaking --chain world_chain_sepolia");
        console.log("With constructor args: stakingToken =", stakingTokenAddress);
        console.log("With constructor args: rewardToken =", rewardTokenAddress);
        
        console.log("\n=== USAGE NOTES ===");
        console.log("- Lock-in period: 10 minutes (for testing)");
        console.log("- Trading percentage: 2% of staked amount");
        console.log("- Reward claims: Only on Sundays after lock-in period");
        console.log("- Supports both legacy and Permit2 staking methods");
    }
} 