// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Script, console} from "forge-std/Script.sol";
import {WorldStaking, RewardToken} from "../src/WorldStaking.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// Mock ERC20 token for deployment (you can replace this with your actual staking token)
contract StakingToken is ERC20 {
    constructor() ERC20("World Staking Token", "WST") {
        _mint(msg.sender, 1_000_000 * 10**18); // Mint 1M tokens to deployer
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract DeployScript is Script {
    function setUp() public {}

    function run() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        // Deploy staking token (or use existing token address)
        StakingToken stakingToken = new StakingToken();
        console.log("StakingToken deployed at:", address(stakingToken));

        // Deploy reward token
        RewardToken rewardToken = new RewardToken();
        console.log("RewardToken deployed at:", address(rewardToken));

        // Deploy WorldStaking contract
        WorldStaking worldStaking = new WorldStaking(
            address(stakingToken),
            address(rewardToken)
        );
        console.log("WorldStaking deployed at:", address(worldStaking));

        // Transfer ownership of reward token to staking contract
        rewardToken.transferOwnership(address(worldStaking));
        console.log("RewardToken ownership transferred to WorldStaking");

        // Optional: Mint some initial tokens to deployer for testing
        stakingToken.mint(msg.sender, 100_000 * 10**18);
        console.log("Minted 100,000 WST tokens to deployer");

        vm.stopBroadcast();

        // Print deployment summary for frontend integration
        console.log("\n=== DEPLOYMENT SUMMARY ===");
        console.log("Network: World Chain Sepolia Testnet");
        console.log("StakingToken (WST):", address(stakingToken));
        console.log("RewardToken (RWD):", address(rewardToken));
        console.log("WorldStaking:", address(worldStaking));
        console.log("Deployer:", msg.sender);
        console.log("\n=== FRONTEND INTEGRATION ===");
        console.log("Add these contract addresses to your frontend:");
        console.log("STAKING_TOKEN_ADDRESS=", address(stakingToken));
        console.log("REWARD_TOKEN_ADDRESS=", address(rewardToken));
        console.log("WORLD_STAKING_ADDRESS=", address(worldStaking));
    }
} 