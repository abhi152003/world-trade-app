// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

// World Vault Manager Contract
contract NewWorldVaultManager is Ownable {
    IERC20 public worldToken; // WLD token

    uint256 public constant LOCKIN_PERIOD = 2 minutes; // 2 minutes lock-in period

    struct Deposit {
        uint256 amount; 
        uint256 timestamp;
        uint256 vaultValue;
        bool active;
    }

    mapping(address => Deposit[]) public deposits; // User deposits as an array
    uint256 public totalTrackedDeposits; // Total amount of tokens that have been deposited and tracked

    event Deposited(address indexed user, uint256 amount, uint256 depositId, uint256 timestamp);
    event Withdrawn(address indexed user, uint256 depositId, uint256 wldAmount, uint256 vaultValue, uint256 timestamp);
    event VaultValueUpdated(address indexed user, uint256 depositId, uint256 newVaultValue);
    event TokensApproved(address indexed user, uint256 amount);
    
    constructor(address _worldToken) Ownable(msg.sender) {
        worldToken = IERC20(_worldToken);
    }

    // Approve tokens for depositing (following original pattern)
    function approveTokensForDeposit(uint256 amount) external {
        require(amount > 0, "Amount must be greater than 0");
        require(worldToken.approve(address(this), amount), "Approval failed");
        emit TokensApproved(msg.sender, amount);
    }

    // Check balance of WLD tokens for a user
    function getWorldTokenBalance(address user) external view returns (uint256) {
        return worldToken.balanceOf(user);
    }

    // Check allowance for a user
    function getAllowance(address user) external view returns (uint256) {
        return worldToken.allowance(user, address(this));
    }

    // Check if user has sufficient allowance for a specific amount
    function hasApprovalFor(address user, uint256 amount) external view returns (bool) {
        return worldToken.allowance(user, address(this)) >= amount;
    }

    // Get the token contract address (users need this to approve tokens)
    function getTokenAddress() external view returns (address) {
        return address(worldToken);
    }

    // Helper function to check what amount user needs to approve for deposit
    function getRequiredApproval(address user, uint256 depositAmount) external view returns (uint256) {
        uint256 currentAllowance = worldToken.allowance(user, address(this));
        if (currentAllowance >= depositAmount) {
            return 0; // No additional approval needed
        }
        return depositAmount - currentAllowance;
    }

    // Get the available balance that can be assigned to new deposits
    function getAvailableBalance() public view returns (uint256) {
        uint256 contractBalance = worldToken.balanceOf(address(this));
        if (contractBalance >= totalTrackedDeposits) {
            return contractBalance - totalTrackedDeposits;
        }
        return 0;
    }

    // Deposit WLD tokens (contract will transfer tokens from user)
    // User must first approve this contract to spend their tokens
    function deposit(uint256 amount) external {
        require(amount > 0, "Amount must be greater than 0");
        require(worldToken.balanceOf(msg.sender) >= amount, "Insufficient balance");
        require(worldToken.allowance(msg.sender, address(this)) >= amount, "Insufficient allowance. Please approve this contract first");

        // Transfer tokens from user to contract
        require(worldToken.transferFrom(msg.sender, address(this), amount), "Transfer failed");

        uint256 depositId = deposits[msg.sender].length;

        deposits[msg.sender].push(Deposit({
            amount: amount,
            timestamp: block.timestamp,
            vaultValue: amount, // Initially the vault value is the same as the deposit
            active: true
        }));

        // Update total tracked deposits
        totalTrackedDeposits += amount;

        emit Deposited(msg.sender, amount, depositId, block.timestamp);
    }

    // Update vault value (called by backend when vault value changes)
    function updateVaultValue(address user, uint256 depositId, uint256 newVaultValue) external onlyOwner {
        require(depositId < deposits[user].length, "Invalid deposit ID");
        Deposit storage userDeposit = deposits[user][depositId];
        require(userDeposit.active, "Deposit not active");

        userDeposit.vaultValue = newVaultValue;
        emit VaultValueUpdated(user, depositId, newVaultValue);
    }

    // Withdraw tokens by deposit ID
    function withdraw(uint256 depositId) external {
        require(depositId < deposits[msg.sender].length, "Invalid deposit ID");
        Deposit storage userDeposit = deposits[msg.sender][depositId];
        require(userDeposit.active, "No active deposit");
        require(block.timestamp >= userDeposit.timestamp + LOCKIN_PERIOD, "Lock-in period not over");

        uint256 currentVaultValue = userDeposit.vaultValue;
        
        // Mark as inactive
        userDeposit.active = false;
        
        // Calculate how many WLD tokens to return based on vault value
        uint256 wldToReturn = currentVaultValue;
        
        // Check if we have enough WLD in the contract
        uint256 contractBalance = worldToken.balanceOf(address(this));
        
        if (contractBalance < wldToReturn) {
            // If we don't have enough WLD, we need the owner to add more
            // This would be handled by your backend
            revert("Insufficient WLD in contract. Please contact support.");
        }
        
        // Update total tracked deposits (reduce by the amount being withdrawn)
        if (totalTrackedDeposits >= wldToReturn) {
            totalTrackedDeposits -= wldToReturn;
        }
        
        // Transfer WLD back to user
        require(worldToken.transfer(msg.sender, wldToReturn), "Transfer failed");

        emit Withdrawn(msg.sender, depositId, wldToReturn, currentVaultValue, block.timestamp);
    }

    // Emergency fund recovery (only owner)
    function recoverTokens(address token, uint256 amount) external onlyOwner {
        IERC20(token).transfer(owner(), amount);
    }

    // Helper function to check if a user can withdraw a specific deposit
    function canWithdraw(address user, uint256 depositId) external view returns (bool) {
        if (depositId >= deposits[user].length) return false;
        Deposit storage userDeposit = deposits[user][depositId];
        return userDeposit.active && block.timestamp >= userDeposit.timestamp + LOCKIN_PERIOD;
    }

    // Get deposit details for a user
    function getDepositDetails(address user, uint256 depositId) external view returns (
        uint256 amount,
        uint256 timestamp,
        uint256 vaultValue,
        bool active
    ) {
        require(depositId < deposits[user].length, "Invalid deposit ID");
        Deposit storage userDeposit = deposits[user][depositId];
        return (
            userDeposit.amount,
            userDeposit.timestamp,
            userDeposit.vaultValue,
            userDeposit.active
        );
    }

    // Get number of deposits for a user
    function getDepositCount(address user) external view returns (uint256) {
        return deposits[user].length;
    }

    // Get total active deposits for a user (in WLD)
    function getTotalActiveDeposits(address user) external view returns (uint256) {
        uint256 total = 0;
        for (uint256 i = 0; i < deposits[user].length; i++) {
            if (deposits[user][i].active) {
                total += deposits[user][i].amount;
            }
        }
        return total;
    }

    // Get total current vault value for a user
    function getTotalVaultValue(address user) external view returns (uint256) {
        uint256 total = 0;
        for (uint256 i = 0; i < deposits[user].length; i++) {
            if (deposits[user][i].active) {
                total += deposits[user][i].vaultValue;
            }
        }
        return total;
    }
}