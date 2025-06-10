// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Script, console} from "forge-std/Script.sol";
import {MinikitTesting} from "../src/MinikitTesting.sol";

contract DeployMinikitTestingScript is Script {
    function setUp() public {}

    function run() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        // Deploy MinikitTesting contract
        MinikitTesting minikitTesting = new MinikitTesting();
        console.log("MinikitTesting deployed at:", address(minikitTesting));

        vm.stopBroadcast();

        // Print deployment summary
        console.log("\n=== MINIKIT TESTING DEPLOYMENT SUMMARY ===");
        console.log("Network: World Chain Sepolia Testnet");
        console.log("MinikitTesting Contract:", address(minikitTesting));
        console.log("Permit2 Address:", address(minikitTesting.permit2()));
        console.log("Token Name:", minikitTesting.name());
        console.log("Token Symbol:", minikitTesting.symbol());
        console.log("Token Decimals:", minikitTesting.decimals());
        console.log("Initial Supply:", minikitTesting.totalSupply());
        console.log("Deployer:", msg.sender);
        
        console.log("\n=== CONTRACT FEATURES ===");
        console.log("* ERC20 token with 0 initial supply");
        console.log("* mintToken() - mint 1 token to caller");
        console.log("* trackCalls() - track function calls per address");
        console.log("* getTotalTokensMinted() - view total supply");
        console.log("* intentionalRevert() - function that always reverts");
        console.log("* signatureTransfer() - Permit2 signature-based transfers");
        console.log("* Permit2 integration for gasless approvals");
    }
} 