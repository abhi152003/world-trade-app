// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Script, console} from "forge-std/Script.sol";
import {WorldStakingTestable, RewardTokenTestable, StakingTokenTestable} from "../src/WorldStakingTestable.sol";

contract DeployTestableScript is Script {
    function setUp() public {}

    function run() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        // Deploy staking token with ERC20Permit functionality
        StakingTokenTestable stakingToken = new StakingTokenTestable();
        console.log("StakingTokenTestable (with Permit) deployed at:", address(stakingToken));

        // Deploy reward token
        RewardTokenTestable rewardToken = new RewardTokenTestable();
        console.log("RewardTokenTestable deployed at:", address(rewardToken));

        // Deploy WorldStakingTestable contract
        WorldStakingTestable worldStakingTestable = new WorldStakingTestable(
            address(stakingToken),
            address(rewardToken)
        );
        console.log("WorldStakingTestable deployed at:", address(worldStakingTestable));

        // Transfer ownership of reward token to staking contract
        rewardToken.transferOwnership(address(worldStakingTestable));
        console.log("RewardTokenTestable ownership transferred to WorldStakingTestable");

        // Optional: Mint some initial tokens to deployer for testing
        stakingToken.mint(msg.sender, 100_000 * 10**18);
        console.log("Minted 100,000 WSTT tokens to deployer");

        vm.stopBroadcast();

        // Print deployment summary for frontend integration
        console.log("\n=== TESTABLE DEPLOYMENT SUMMARY (WITH PERMIT) ===");
        console.log("Network: World Chain Sepolia Testnet");
        console.log("StakingTokenTestable (WSTT):", address(stakingToken));
        console.log("RewardTokenTestable (RWDT):", address(rewardToken));
        console.log("WorldStakingTestable:", address(worldStakingTestable));
        console.log("Deployer:", msg.sender);
        console.log("\n=== FRONTEND INTEGRATION (TESTABLE WITH PERMIT) ===");
        console.log("Add these contract addresses to your frontend for testing:");
        console.log("STAKING_TOKEN_ADDRESS=", address(stakingToken));
        console.log("REWARD_TOKEN_ADDRESS=", address(rewardToken));
        console.log("WORLD_STAKING_ADDRESS=", address(worldStakingTestable));
        console.log("\n=== KEY FEATURES ===");
        console.log("* ERC20Permit support for gasless approvals");
        console.log("* Single-transaction staking with stakeWithPermit()");
        console.log("* No Sunday restriction for testing rewards");
        console.log("* Perfect for testing both traditional and permit flows");
    }
} 