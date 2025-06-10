// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import {Script, console} from "forge-std/Script.sol";
import {Permit2} from "../src/permit2/Permit2.sol";

/**
 * @title DeployPermit2Script
 * @notice Deployment script for Permit2 contract on World Chain Sepolia
 * @dev This script deploys the Permit2 contract which handles both signature-based 
 *      and allowance-based token transfers
 */
contract DeployPermit2Script is Script {
    
    /// @notice Address where Permit2 will be deployed
    address public permit2Address;
    
    function setUp() public {}

    /**
     * @notice Main deployment function
     * @dev Deploys Permit2 contract and logs deployment details
     */
    function run() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("=== PERMIT2 DEPLOYMENT STARTING ===");
        console.log("Deployer address:", deployer);
        console.log("Network: World Chain Sepolia Testnet");
        
        vm.startBroadcast(deployerPrivateKey);

        // Deploy Permit2 contract
        Permit2 permit2 = new Permit2();
        permit2Address = address(permit2);
        
        console.log("Permit2 deployed successfully at:", permit2Address);

        vm.stopBroadcast();

        _logDeploymentSummary(deployer);
    }

    /**
     * @notice Logs comprehensive deployment summary
     * @param deployer Address that deployed the contracts
     */
    function _logDeploymentSummary(address deployer) private view {
        console.log("\n=== DEPLOYMENT SUMMARY ===");
        console.log("Network: World Chain Sepolia Testnet (Chain ID: 4801)");
        console.log("Permit2 Contract:", permit2Address);
        console.log("Deployer:", deployer);
        console.log("Block:", block.number);
        console.log("Timestamp:", block.timestamp);
        
        console.log("\n=== FRONTEND INTEGRATION ===");
        console.log("Add this contract address to your frontend:");
        console.log("PERMIT2_ADDRESS=", permit2Address);
        
        console.log("\n=== VERIFICATION COMMAND ===");
        console.log("To verify the contract, run:");
        console.log("forge verify-contract", permit2Address, "src/permit2/Permit2.sol:Permit2 --chain world_chain_sepolia");
        
        console.log("\n=== USAGE NOTES ===");
        console.log("- Users must approve Permit2 before calling transfer functions");
        console.log("- Supports both signature-based and allowance-based transfers");
        console.log("- No initialization required - contract is ready to use");
    }
} 