'use client';

import { useState } from 'react';
import { useAccount, useReadContract, useWriteContract } from 'wagmi';
import { CONTRACT_ADDRESSES, ERC20_ABI, WORLD_STAKING_ABI } from '../constants/contracts';
import { formatBigInt } from '../utils/format';
import { parseEther } from 'viem';

export function StakingForm() {
  const [amount, setAmount] = useState('');
  const [isApproving, setIsApproving] = useState(false);
  const [isStaking, setIsStaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();

  // Get user's token balance
  const { data: balance } = useReadContract({
    address: CONTRACT_ADDRESSES.STAKING_TOKEN as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [address as `0x${string}`],
    query: {
      enabled: !!address,
    },
  });

  // Get current allowance for staking contract
  const { data: allowance } = useReadContract({
    address: CONTRACT_ADDRESSES.STAKING_TOKEN as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [address as `0x${string}`, CONTRACT_ADDRESSES.WORLD_STAKING as `0x${string}`],
    query: {
      enabled: !!address,
    },
  });

  const handleApprove = async () => {
    if (!amount || !address) return;
    
    try {
      setError(null);
      setIsApproving(true);
      
      const amountToApprove = parseEther(amount);
      
      await writeContractAsync({
        address: CONTRACT_ADDRESSES.STAKING_TOKEN as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [CONTRACT_ADDRESSES.WORLD_STAKING, amountToApprove],
      });
      
    } catch (err: any) {
      console.error('Error approving tokens:', err);
      setError('Failed to approve tokens. Please try again.');
    } finally {
      setIsApproving(false);
    }
  };

  const handleStake = async () => {
    if (!amount || !address) return;
    
    try {
      setError(null);
      setIsStaking(true);
      
      const amountToStake = parseEther(amount);
      
      await writeContractAsync({
        address: CONTRACT_ADDRESSES.WORLD_STAKING as `0x${string}`,
        abi: WORLD_STAKING_ABI,
        functionName: 'stake',
        args: [amountToStake],
      });
      
      // Clear form after successful stake
      setAmount('');
      
    } catch (err: any) {
      console.error('Error staking tokens:', err);
      setError('Failed to stake tokens. Please try again.');
    } finally {
      setIsStaking(false);
    }
  };

  const handleMaxAmount = () => {
    if (balance) {
      setAmount(formatBigInt(balance as bigint));
    }
  };

  // Format balance for display
  const formattedBalance = balance ? formatBigInt(balance as bigint) : '0';
  
  // Check if user needs to approve tokens before staking
  const needsApproval = allowance && amount ? parseEther(amount) > (allowance as bigint) : false;

  return (
    <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
      <h2 className="text-xl font-bold mb-4">Stake Tokens</h2>
      
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Amount to Stake</label>
        <div className="relative">
          <input
            type="text"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.0"
            className="w-full p-2 rounded bg-gray-700 border border-gray-600 focus:border-blue-500 focus:ring focus:ring-blue-500 focus:ring-opacity-50"
          />
          <div className="absolute inset-y-0 right-0 flex items-center pr-3">
            <button 
              onClick={handleMaxAmount}
              className="text-blue-400 text-xs hover:text-blue-300"
            >
              MAX
            </button>
          </div>
        </div>
        <p className="mt-1 text-sm text-gray-400">Balance: {formattedBalance} WST</p>
      </div>
      
      {error && (
        <div className="mb-4 p-2 bg-red-900/50 border border-red-700 rounded text-sm">
          {error}
        </div>
      )}
      
      <div className="flex flex-col gap-2">
        {needsApproval ? (
          <button
            onClick={handleApprove}
            disabled={!amount || isApproving || !address}
            className={`w-full p-2 rounded font-medium ${
              isApproving
                ? 'bg-blue-800 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {isApproving ? 'Approving...' : 'Approve Tokens'}
          </button>
        ) : (
          <button
            onClick={handleStake}
            disabled={!amount || isStaking || !address}
            className={`w-full p-2 rounded font-medium ${
              isStaking
                ? 'bg-blue-800 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {isStaking ? 'Staking...' : 'Stake Tokens'}
          </button>
        )}
      </div>
      
      <div className="mt-4 text-sm text-gray-400">
        <p>• Staking locks your tokens for 10 minutes (for testing)</p>
        <p>• 2% of staked amount will be used for trading</p>
        <p>• Rewards can be claimed anytime after lock period</p>
      </div>
    </div>
  );
} 