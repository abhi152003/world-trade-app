// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

// Interface for Permit2 SignatureTransfer
interface ISignatureTransfer {
    /// @notice The token and amount details for a transfer signed in the permit transfer signature
    struct TokenPermissions {
        // ERC20 token address
        address token;
        // the maximum amount that can be spent
        uint256 amount;
    }

    /// @notice The signed permit message for a single token transfer
    struct PermitTransferFrom {
        TokenPermissions permitted;
        // a unique value for every token owner's signature to prevent signature replays
        uint256 nonce;
        // deadline on the permit signature
        uint256 deadline;
    }

    /// @notice Specifies the recipient address and amount for batched transfers.
    /// @dev Recipients and amounts correspond to the index of the signed token permissions array.
    /// @dev Reverts if the requested amount is greater than the permitted signed amount.
    struct SignatureTransferDetails {
        // recipient address
        address to;
        // spender requested amount
        uint256 requestedAmount;
    }

    /// @notice Transfers a token using a signed permit message
    /// @dev Reverts if the requested amount is greater than the permitted signed amount
    /// @param permit The permit data signed over by the owner
    /// @param owner The owner of the tokens to transfer
    /// @param transferDetails The spender's requested transfer details for the permitted token
    /// @param signature The signature to verify
    function permitTransferFrom(
        PermitTransferFrom memory permit,
        SignatureTransferDetails calldata transferDetails,
        address owner,
        bytes calldata signature
    ) external;

    /// @notice A map from token owner address and a caller specified word index to a bitmap. Used to set bits in the bitmap to prevent against signature replay protection
    /// @dev Uses unordered nonces so that permit messages do not need to be spent in a certain order
    /// @dev The mapping is indexed first by the token owner, then by an index specified in the nonce
    /// @dev It returns a uint256 bitmap
    /// @dev The index, or wordPosition is capped at type(uint248).max
    function nonceBitmap(address, uint256) external view returns (uint256);
}

/**
 * @title VaultManager
 * @dev A contract for managing ERC20 token deposits with backend-controlled withdrawal amounts
 */
contract VaultManagerPermit2 is Ownable, ReentrancyGuard {
    IERC20 public token; // The ERC20 token being managed
    ISignatureTransfer public immutable permit2; // Permit2 contract

    struct Deposit {
        uint256 depositedAmount; // Original amount deposited by user
        uint256 withdrawableAmount; // Current amount user can withdraw (updated by backend)
        uint256 depositTimestamp; // When the deposit was made
        bool active; // Whether the deposit is still active
    }

    // User address => array of deposits
    mapping(address => Deposit[]) public userDeposits;
    
    // Track total deposited and withdrawable amounts for accounting
    uint256 public totalDeposited;
    uint256 public totalWithdrawable;

    // Events
    event Deposited(
        address indexed user, 
        uint256 indexed depositId, 
        uint256 amount, 
        uint256 timestamp
    );
    
    event WithdrawalAmountUpdated(
        address indexed user, 
        uint256 indexed depositId, 
        uint256 oldAmount, 
        uint256 newAmount
    );
    
    event Withdrawn(
        address indexed user, 
        uint256 indexed depositId, 
        uint256 amount, 
        uint256 timestamp
    );

    constructor(address _token) Ownable(msg.sender) {
        require(_token != address(0), "Invalid token address");
        token = IERC20(_token);
        // Universal Permit2 contract address deployed on all EVM chains
        permit2 = ISignatureTransfer(0x000000000022D473030F116dDEE9F6B43aC78BA3);
    }

    /**
     * @notice Deposit ERC20 tokens using Permit2 signature-based transfer
     * @param amount Amount of tokens to deposit
     * @param permitData The permit data containing token permissions, nonce, and deadline  
     * @param signature The signature authorizing the transfer
     * @dev This replaces the approve + transferFrom pattern with a single signature-based transfer
     */
    function depositWithPermit2(
        uint256 amount,
        ISignatureTransfer.PermitTransferFrom calldata permitData,
        bytes calldata signature
    ) external nonReentrant {
        require(amount > 0, "Amount must be greater than 0");
        require(token.balanceOf(msg.sender) >= amount, "Insufficient balance");
        
        // Verify permit data matches the amount and token
        require(permitData.permitted.token == address(token), "Invalid token in permit");
        require(permitData.permitted.amount >= amount, "Insufficient permit amount");
        require(block.timestamp <= permitData.deadline, "Permit expired");

        // Create transfer details
        ISignatureTransfer.SignatureTransferDetails memory transferDetails = 
            ISignatureTransfer.SignatureTransferDetails({
                to: address(this),
                requestedAmount: amount
            });

        // Execute the signature-based transfer through Permit2
        permit2.permitTransferFrom(
            permitData,
            transferDetails,
            msg.sender,
            signature
        );

        // Create new deposit record
        uint256 depositId = userDeposits[msg.sender].length;
        userDeposits[msg.sender].push(Deposit({
            depositedAmount: amount,
            withdrawableAmount: amount, // Initially, withdrawable amount equals deposited amount
            depositTimestamp: block.timestamp,
            active: true
        }));

        // Update total amounts
        totalDeposited += amount;
        totalWithdrawable += amount;

        emit Deposited(msg.sender, depositId, amount, block.timestamp);
    }

    /**
     * @notice Legacy deposit function (kept for backward compatibility)
     * @param amount Amount of tokens to deposit
     * @dev Users need to approve tokens first using token.approve(vaultContract, amount)
     */
    function deposit(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be greater than 0");
        require(token.balanceOf(msg.sender) >= amount, "Insufficient balance");
        require(token.allowance(msg.sender, address(this)) >= amount, "Insufficient allowance. Please approve this contract first");

        // Transfer tokens from user to contract
        require(token.transferFrom(msg.sender, address(this), amount), "Transfer failed");

        // Create new deposit record
        uint256 depositId = userDeposits[msg.sender].length;
        userDeposits[msg.sender].push(Deposit({
            depositedAmount: amount,
            withdrawableAmount: amount, // Initially, withdrawable amount equals deposited amount
            depositTimestamp: block.timestamp,
            active: true
        }));

        // Update total amounts
        totalDeposited += amount;
        totalWithdrawable += amount;

        emit Deposited(msg.sender, depositId, amount, block.timestamp);
    }

    /**
     * @dev Update the withdrawable amount for a specific deposit (only owner/backend)
     * @param user User address
     * @param depositId ID of the deposit to update
     * @param newWithdrawableAmount New withdrawable amount
     */
    function updateWithdrawableAmount(
        address user, 
        uint256 depositId, 
        uint256 newWithdrawableAmount
    ) external onlyOwner {
        require(depositId < userDeposits[user].length, "Invalid deposit ID");
        Deposit storage userDeposit = userDeposits[user][depositId];
        require(userDeposit.active, "Deposit not active");

        uint256 oldAmount = userDeposit.withdrawableAmount;
        userDeposit.withdrawableAmount = newWithdrawableAmount;

        // Update total withdrawable amount
        totalWithdrawable = totalWithdrawable - oldAmount + newWithdrawableAmount;

        emit WithdrawalAmountUpdated(user, depositId, oldAmount, newWithdrawableAmount);
    }

    /**
     * @dev Withdraw tokens from a specific deposit
     * @param depositId ID of the deposit to withdraw from
     */
    function withdraw(uint256 depositId) external nonReentrant {
        require(depositId < userDeposits[msg.sender].length, "Invalid deposit ID");
        Deposit storage userDeposit = userDeposits[msg.sender][depositId];
        require(userDeposit.active, "Deposit not active");
        require(userDeposit.withdrawableAmount > 0, "No withdrawable amount");

        uint256 withdrawAmount = userDeposit.withdrawableAmount;
        
        // Check if contract has enough tokens
        require(token.balanceOf(address(this)) >= withdrawAmount, "Insufficient contract balance");

        // Mark deposit as inactive
        userDeposit.active = false;
        
        // Update total amounts
        totalWithdrawable -= withdrawAmount;

        // Transfer tokens to user
        require(token.transfer(msg.sender, withdrawAmount), "Transfer failed");

        emit Withdrawn(msg.sender, depositId, withdrawAmount, block.timestamp);
    }

    /**
     * @dev Get deposit details for a user
     * @param user User address
     * @param depositId Deposit ID
     */
    function getDepositDetails(address user, uint256 depositId) 
        external 
        view 
        returns (
            uint256 depositedAmount,
            uint256 withdrawableAmount,
            uint256 depositTimestamp,
            bool active
        ) 
    {
        require(depositId < userDeposits[user].length, "Invalid deposit ID");
        Deposit storage userDeposit = userDeposits[user][depositId];
        return (
            userDeposit.depositedAmount,
            userDeposit.withdrawableAmount,
            userDeposit.depositTimestamp,
            userDeposit.active
        );
    }

    /**
     * @dev Get number of deposits for a user
     * @param user User address
     */
    function getUserDepositCount(address user) external view returns (uint256) {
        return userDeposits[user].length;
    }

    /**
     * @dev Get all active deposits for a user
     * @param user User address
     */
    function getUserActiveDeposits(address user) 
        external 
        view 
        returns (
            uint256[] memory depositIds,
            uint256[] memory depositedAmounts,
            uint256[] memory withdrawableAmounts,
            uint256[] memory timestamps
        ) 
    {
        // Count active deposits
        uint256 activeCount = 0;
        for (uint256 i = 0; i < userDeposits[user].length; i++) {
            if (userDeposits[user][i].active) {
                activeCount++;
            }
        }

        // Create arrays for active deposits
        depositIds = new uint256[](activeCount);
        depositedAmounts = new uint256[](activeCount);
        withdrawableAmounts = new uint256[](activeCount);
        timestamps = new uint256[](activeCount);

        // Fill arrays with active deposit data
        uint256 index = 0;
        for (uint256 i = 0; i < userDeposits[user].length; i++) {
            if (userDeposits[user][i].active) {
                depositIds[index] = i;
                depositedAmounts[index] = userDeposits[user][i].depositedAmount;
                withdrawableAmounts[index] = userDeposits[user][i].withdrawableAmount;
                timestamps[index] = userDeposits[user][i].depositTimestamp;
                index++;
            }
        }
    }

    /**
     * @dev Get total withdrawable amount for a user across all active deposits
     * @param user User address
     */
    function getTotalWithdrawableForUser(address user) external view returns (uint256) {
        uint256 total = 0;
        for (uint256 i = 0; i < userDeposits[user].length; i++) {
            if (userDeposits[user][i].active) {
                total += userDeposits[user][i].withdrawableAmount;
            }
        }
        return total;
    }

    /**
     * @dev Get total deposited amount for a user across all deposits (including inactive)
     * @param user User address
     */
    function getTotalDepositedForUser(address user) external view returns (uint256) {
        uint256 total = 0;
        for (uint256 i = 0; i < userDeposits[user].length; i++) {
            total += userDeposits[user][i].depositedAmount;
        }
        return total;
    }

    /**
     * @dev Check allowance for a user
     * @param user User address
     */
    function getAllowance(address user) external view returns (uint256) {
        return token.allowance(user, address(this));
    }

    /**
     * @dev Check token balance for a user
     * @param user User address
     */
    function getTokenBalance(address user) external view returns (uint256) {
        return token.balanceOf(user);
    }

    /**
     * @dev Get contract's token balance
     */
    function getContractBalance() external view returns (uint256) {
        return token.balanceOf(address(this));
    }

    /**
     * @dev Emergency function to recover tokens (only owner)
     * @param tokenAddress Token address to recover
     * @param amount Amount to recover
     */
    function emergencyRecoverTokens(address tokenAddress, uint256 amount) external onlyOwner {
        IERC20(tokenAddress).transfer(owner(), amount);
    }

    /**
     * @dev Get the token contract address
     */
    function getTokenAddress() external view returns (address) {
        return address(token);
    }

    /**
     * @notice Check nonce bitmap for a user (for Permit2)
     * @param user User address to check
     * @param wordPosition Word position in the nonce bitmap
     * @return The nonce bitmap value
     */
    function getNonceBitmap(address user, uint256 wordPosition) external view returns (uint256) {
        return permit2.nonceBitmap(user, wordPosition);
    }

    /**
     * @notice Get the Permit2 contract address
     * @return The address of the Permit2 contract
     */
    function getPermit2Address() external view returns (address) {
        return address(permit2);
    }
} 