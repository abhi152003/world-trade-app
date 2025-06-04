'use client';

import { useState, useEffect } from 'react';
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
  
  // Get token allowance
  const { data: allowance } = useReadContract({
    address: CONTRACT_ADDRESSES.STAKING_TOKEN as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [address as `0x${string}`, CONTRACT_ADDRESSES.WORLD_STAKING as `0x${string}`],
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

  if (!address) {
    return null;
  }

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
            <div className="font-mono">{address}</div>
            
            <div className="text-gray-400">WST Balance:</div>
            <div>{balance ? formatBigInt(balance as bigint) : 'Loading...'}</div>
            
            <div className="text-gray-400">WST Allowance:</div>
            <div>{allowance ? formatBigInt(allowance as bigint) : 'Loading...'}</div>
            
            <div className="text-gray-400">Stake Count:</div>
            <div>{stakeCount !== undefined ? stakeCount?.toString() : 'Loading...'}</div>
            
            <div className="text-gray-400">Staking Token:</div>
            <div className="font-mono text-xs">{CONTRACT_ADDRESSES.STAKING_TOKEN}</div>
            
            <div className="text-gray-400">World Staking:</div>
            <div className="font-mono text-xs">{CONTRACT_ADDRESSES.WORLD_STAKING}</div>
          </div>
        </div>
      )}
    </div>
  );
} 