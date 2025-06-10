# Update Contract Addresses

After deploying the WorldStaking Permit2 contracts, you need to update the frontend configuration.

## Step 1: Update Contract Addresses

Edit `frontend/app/constants/contracts.ts` and replace the placeholder addresses:

```typescript
export const CONTRACT_ADDRESSES = {
  STAKING_TOKEN: '0x_DEPLOYED_STAKING_TOKEN_ADDRESS_',
  REWARD_TOKEN: '0x_DEPLOYED_REWARD_TOKEN_ADDRESS_',
  WORLD_STAKING: '0x_DEPLOYED_WORLD_STAKING_ADDRESS_',
  PERMIT2: '0xFB8e062817CDBed024c00eC2E351060A1f6C4ae2' // This is correct
};
```

## Step 2: Verify Contract ABIs

The ABIs should match the deployed contracts. If you've made changes to the contracts, update the ABIs accordingly.

## Step 3: Test Frontend Integration

1. Start the frontend development server
2. Connect your wallet to World Chain Sepolia
3. Check the Debug Info section to verify contract connections
4. Test both Permit2 and legacy staking methods

## Notes

- The Permit2 address is already set to the deployed contract on World Chain Sepolia
- Make sure your wallet has some WST tokens for testing
- Approve Permit2 for the staking token to use signature-based staking 