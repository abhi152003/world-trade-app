import { 
  CONTRACT_ADDRESSES, 
  PERMIT2_DOMAIN_NAME, 
  PERMIT_TRANSFER_FROM_TYPE,
  WORLD_CHAIN_SEPOLIA_CHAIN_ID 
} from '../constants/contracts';

/**
 * @notice Types for Permit2 signature generation
 */
export interface TokenPermissions {
  token: string;
  amount: bigint;
}

export interface PermitTransferFrom {
  permitted: TokenPermissions;
  nonce: bigint;
  deadline: bigint;
}

export interface SignatureData {
  domain: {
    name: string;
    chainId: number;
    verifyingContract: `0x${string}`;
  };
  types: typeof PERMIT_TRANSFER_FROM_TYPE;
  message: Record<string, unknown>;
}

/**
 * @notice Generates a random nonce for Permit2 signatures
 * @dev Uses crypto.getRandomValues for secure randomness
 * @returns Random nonce as bigint
 */
export function generateRandomNonce(): bigint {
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);
  
  // Convert to bigint, ensuring it's positive and within uint256 range
  let nonce = 0n;
  for (let i = 0; i < randomBytes.length; i++) {
    nonce = (nonce << 8n) + BigInt(randomBytes[i]);
  }
  
  return nonce;
}

/**
 * @notice Calculates deadline timestamp (current time + minutes)
 * @param minutesFromNow Number of minutes from current time
 * @returns Deadline timestamp as bigint
 */
export function calculateDeadline(minutesFromNow: number = 30): bigint {
  const now = Math.floor(Date.now() / 1000);
  const deadline = now + (minutesFromNow * 60);
  return BigInt(deadline);
}

/**
 * @notice Creates EIP-712 signature data for Permit2 transfer
 * @param stakingTokenAddress Address of the token to be transferred
 * @param amount Amount of tokens to transfer
 * @param nonce Random nonce for signature uniqueness
 * @param deadline Expiration timestamp for the permit
 * @returns Complete signature data object for EIP-712 signing
 */
export function createPermit2SignatureData(
  stakingTokenAddress: string,
  amount: bigint,
  nonce: bigint,
  deadline: bigint
): SignatureData {
  return {
    domain: {
      name: PERMIT2_DOMAIN_NAME,
      chainId: WORLD_CHAIN_SEPOLIA_CHAIN_ID,
      verifyingContract: CONTRACT_ADDRESSES.PERMIT2 as `0x${string}`,
    },
    types: PERMIT_TRANSFER_FROM_TYPE,
    message: {
      permitted: {
        token: stakingTokenAddress,
        amount: amount,
      },
      nonce: nonce,
      deadline: deadline,
    },
  };
}

/**
 * @notice Creates permit data structure for contract interaction
 * @param stakingTokenAddress Address of the token to be transferred
 * @param amount Amount of tokens to transfer
 * @param nonce Random nonce used in signature
 * @param deadline Expiration timestamp for the permit
 * @returns Permit data structure for contract calls
 */
export function createPermitData(
  stakingTokenAddress: string,
  amount: bigint,
  nonce: bigint,
  deadline: bigint
) {
  return {
    permitted: {
      token: stakingTokenAddress,
      amount: amount,
    },
    nonce: nonce,
    deadline: deadline,
  };
}

/**
 * @notice Validates permit signature parameters
 * @param stakingTokenAddress Token address to validate
 * @param amount Amount to validate (must be > 0)
 * @param deadline Deadline to validate (must be in future)
 * @returns True if all parameters are valid
 */
export function validatePermitParams(
  stakingTokenAddress: string,
  amount: bigint,
  deadline: bigint
): boolean {
  const now = BigInt(Math.floor(Date.now() / 1000));
  
  return (
    stakingTokenAddress !== '' &&
    stakingTokenAddress.startsWith('0x') &&
    stakingTokenAddress.length === 42 &&
    amount > 0n &&
    deadline > now
  );
}

/**
 * @notice Checks if user needs to approve Permit2 for token spending
 * @param userAddress User's wallet address
 * @param tokenAddress Token contract address
 * @param amount Amount to check allowance for
 * @param tokenAllowance Current allowance for Permit2 contract
 * @returns True if approval is needed
 */
export function needsPermit2Approval(
  userAddress: string,
  tokenAddress: string,
  amount: bigint,
  tokenAllowance: bigint | undefined
): boolean {
  if (!userAddress || !tokenAddress || amount <= 0n) {
    return false;
  }
  
  return tokenAllowance === undefined || tokenAllowance < amount;
} 