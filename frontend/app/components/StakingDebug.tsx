'use client';

import { useState } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import { CONTRACT_ADDRESSES, ERC20_ABI, WORLD_STAKING_ABI } from '../constants/contracts';
import { formatBigInt } from '../utils/format';

export function StakingDebug() {
  const { address } = useAccount();
  const [isOpen, setIsOpen] = useState(false);
  
  // Get token balance
  const { data: balance } = useReadContract({
    address: CONTRACT_ADDRESSES.STAKING_TOKEN as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [address as `0x${string}`],
    query: {
      enabled: !!address,
    },
  });
  
  // Get token allowance for WorldStaking (legacy)
  const { data: stakingAllowance } = useReadContract({
    address: CONTRACT_ADDRESSES.STAKING_TOKEN as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [address as `0x${string}`, CONTRACT_ADDRESSES.WORLD_STAKING as `0x${string}`],
    query: {
      enabled: !!address,
    },
  });

  // Get token allowance for Permit2
  const { data: permit2Allowance } = useReadContract({
    address: CONTRACT_ADDRESSES.STAKING_TOKEN as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [address as `0x${string}`, CONTRACT_ADDRESSES.PERMIT2 as `0x${string}`],
    query: {
      enabled: !!address,
    },
  });
  
  // Get stake count
  const { data: stakeCount } = useReadContract({
    address: CONTRACT_ADDRESSES.WORLD_STAKING as `0x${string}`,
    abi: WORLD_STAKING_ABI,
    functionName: 'getStakeCount',
    args: [address as `0x${string}`],
    query: {
      enabled: !!address,
    },
  });

  // Get Permit2 nonce bitmap (for debugging)
  const { data: nonceBitmap } = useReadContract({
    address: CONTRACT_ADDRESSES.WORLD_STAKING as `0x${string}`,
    abi: WORLD_STAKING_ABI,
    functionName: 'getNonceBitmap',
    args: [address as `0x${string}`, 0n], // Check word position 0
    query: {
      enabled: !!address,
    },
  });

  // Get the Permit2 address from the WorldStaking contract
  const { data: contractPermit2Address } = useReadContract({
    address: CONTRACT_ADDRESSES.WORLD_STAKING as `0x${string}`,
    abi: WORLD_STAKING_ABI,
    functionName: 'getPermit2Address',
    args: [],
    query: {
      enabled: !!address,
    },
  });

  if (!address) {
    return null;
  }

  console.log('Debug data:', {
    balance,
    stakingAllowance,
    permit2Allowance,
    stakeCount,
    nonceBitmap,
    contractPermit2Address
  });

  // Helper for permit2 allowance styling
  const permit2HasAllowance = permit2Allowance !== undefined && (permit2Allowance as bigint) > 0n;

  return (
    <div className="mt-4 border border-gray-700 rounded-lg p-4">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full text-left"
      >
        <span className="font-medium">Staking Debug Info</span>
        <span>{isOpen ? '▼' : '►'}</span>
      </button>
      
      {isOpen && (
        <div className="mt-3 text-sm">
          <div className="grid grid-cols-2 gap-2">
            <div className="text-gray-400">Connected Address:</div>
            <div className="font-mono text-xs">{address}</div>
            
            <div className="text-gray-400">WST Balance:</div>
            <div>{balance ? formatBigInt(balance as bigint) : 'Loading...'}</div>
            
            <div className="text-gray-400">Legacy Allowance:</div>
            <div>{stakingAllowance !== undefined ? formatBigInt(stakingAllowance as bigint) : 'Loading...'}</div>
            
            <div className="text-gray-400">Permit2 Allowance:</div>
            <div className="text-gray-400">
              {permit2Allowance !== undefined ? formatBigInt(permit2Allowance as bigint) : 'Loading...'} 
              <span className="text-xs">(Not required for SignatureTransfer)</span>
            </div>
            
            <div className="text-gray-400">Stake Count:</div>
            <div>{stakeCount !== undefined ? stakeCount?.toString() : 'Loading...'}</div>
            
            <div className="text-gray-400">Nonce Bitmap (0):</div>
            <div className="font-mono text-xs">{nonceBitmap !== undefined ? nonceBitmap?.toString() : 'Loading...'}</div>
            
            <div className="text-gray-400">Contract Permit2 Address:</div>
            <div className="font-mono text-xs break-all">{contractPermit2Address ? String(contractPermit2Address) : 'Loading...'}</div>
          </div>
          
          <div className="mt-4 pt-3 border-t border-gray-600">
            <div className="grid grid-cols-1 gap-2">
              <div>
                <div className="text-gray-400">Staking Token:</div>
                <div className="font-mono text-xs break-all">{CONTRACT_ADDRESSES.STAKING_TOKEN}</div>
              </div>
              
              <div>
                <div className="text-gray-400">World Staking:</div>
                <div className="font-mono text-xs break-all">{CONTRACT_ADDRESSES.WORLD_STAKING}</div>
              </div>
              
              <div>
                <div className="text-gray-400">Permit2 Contract:</div>
                <div className="font-mono text-xs break-all">{CONTRACT_ADDRESSES.PERMIT2}</div>
              </div>
            </div>
          </div>
          
          <div className="mt-4 pt-3 border-t border-gray-600">
            <div className="text-xs text-gray-500">
              <p><strong>Note:</strong> Update contract addresses after deployment!</p>
              <p><strong>Permit2 SignatureTransfer:</strong> No pre-approval needed - signatures grant per-transaction permission</p>
              <p><strong>Legacy Allowance:</strong> Used for traditional approve+stake method</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 