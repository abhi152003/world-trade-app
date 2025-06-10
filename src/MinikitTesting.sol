// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ERC20} from "./ERC20.sol";
import {ISignatureTransfer} from "./ISignatureTransfer.sol";

contract MinikitTesting is ERC20 {
    ISignatureTransfer public immutable permit2;

    // Mapping to track function calls per address
    mapping(address => uint256) public functionCalls;

    constructor() ERC20("Mini Token", "MKT", 18) {
        // Initial supply of 0 tokens
        permit2 = ISignatureTransfer(
            address(0x000000000022D473030F116dDEE9F6B43aC78BA3)
        );
    }

    // Function to mint tokens
    function mintToken() external {
        _mint(msg.sender, 1e18); // Mint 1 token (using 18 decimals)
    }

    // Function to track number of calls
    function trackCalls() external {
        functionCalls[msg.sender] += 1;
    }

    // Function to view total tokens minted
    function getTotalTokensMinted() external view returns (uint256) {
        return totalSupply;
    }

    // Function that intentionally reverts
    function intentionalRevert() external pure {
        revert("intentional revert");
    }

    // Sends the funds to this contract
    function signatureTransfer(
        ISignatureTransfer.PermitTransferFrom memory permitTransferFrom,
        ISignatureTransfer.SignatureTransferDetails calldata transferDetails,
        bytes calldata signature
    ) public {
        permit2.permitTransferFrom(
            permitTransferFrom,
            transferDetails,
            msg.sender,
            signature
        );
    }
}