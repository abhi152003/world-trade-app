'use client';

import { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract } from 'wagmi';
import { CONTRACT_ADDRESSES, WORLD_STAKING_ABI } from '../constants/contracts';
import { formatBigInt, formatTimestamp, formatTimeRemaining } from '../utils/format';
import { createPublicClient, http } from 'viem';
import { worldChainSepolia } from '../constants/chains';

type StakeDetails = {
  amount: bigint;
  timestamp: bigint;
  tradingAmount: bigint;
  currentTradeValue: bigint;
  tradeActive: boolean;
  claimableRewards: bigint;
  active: boolean;
  index: number;
};

export function StakesList() {
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const [stakes, setStakes] = useState<StakeDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unstaking, setUnstaking] = useState<number | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [canUnstakeMap, setCanUnstakeMap] = useState<Record<number, boolean>>({});

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

  // Load stake details
  useEffect(() => {
    async function fetchStakes() {
      if (!address || stakeCount === undefined) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const count = Number(stakeCount);
        console.log('Stake count:', count);
        const newStakes: StakeDetails[] = [];
        const newCanUnstakeMap: Record<number, boolean> = {};
        
        // Create a public client for direct contract calls
        const publicClient = createPublicClient({
          chain: worldChainSepolia,
          transport: http()
        });

        // Fetch each stake's details
        for (let i = 0; i < count; i++) {
          try {
            // Type assertion to handle the response properly
            const result = await publicClient.readContract({
              address: CONTRACT_ADDRESSES.WORLD_STAKING as `0x${string}`,
              abi: WORLD_STAKING_ABI,
              functionName: 'getStakeDetails',
              args: [address, BigInt(i)]
            }) as unknown as [bigint, bigint, bigint, bigint, boolean, bigint, boolean];
            
            console.log(`Stake ${i} details:`, result);
            
            // Always include the stake in our list for debugging
            const stakeDetails = {
              amount: result[0],
              timestamp: result[1],
              tradingAmount: result[2],
              currentTradeValue: result[3],
              tradeActive: result[4],
              claimableRewards: result[5],
              active: result[6],
              index: i,
            };
            
            // Add all stakes to the list - we'll filter for display later
            newStakes.push(stakeDetails);
            
            // Check if this stake can be unstaked (only for active stakes)
            if (stakeDetails.active) {
              try {
                const canUnstake = await publicClient.readContract({
                  address: CONTRACT_ADDRESSES.WORLD_STAKING as `0x${string}`,
                  abi: WORLD_STAKING_ABI,
                  functionName: 'canUnstake',
                  args: [address, BigInt(i)]
                }) as boolean;
                
                newCanUnstakeMap[i] = canUnstake;
              } catch (err) {
                console.error(`Error checking if stake ${i} can be unstaked:`, err);
                newCanUnstakeMap[i] = false;
              }
            }
          } catch (err) {
            console.error(`Error fetching stake ${i}:`, err);
          }
        }
        
        console.log('All stakes:', newStakes);
        setStakes(newStakes);
        setCanUnstakeMap(newCanUnstakeMap);
      } catch (err) {
        console.error('Error loading stakes:', err);
        setError('Failed to load stakes. Please refresh the page.');
      } finally {
        setLoading(false);
      }
    }
    
    fetchStakes();
  }, [address, stakeCount, refreshTrigger]);

  // Check if rewards can be claimed
  const { data: canClaimRewardsData } = useReadContract({
    address: CONTRACT_ADDRESSES.WORLD_STAKING as `0x${string}`,
    abi: WORLD_STAKING_ABI,
    functionName: 'canClaimRewards',
    args: [address as `0x${string}`],
    query: {
      enabled: !!address,
    },
  });

  // Get the current day of week
  const { data: dayOfWeek } = useReadContract({
    address: CONTRACT_ADDRESSES.WORLD_STAKING as `0x${string}`,
    abi: WORLD_STAKING_ABI,
    functionName: 'getDayOfWeek',
    args: [],
    query: {
      enabled: !!address,
    },
  });

  // Handle unstaking
  const handleUnstake = async (index: number) => {
    if (!address) return;
    
    try {
      setUnstaking(index);
      
      if (!canUnstakeMap[index]) {
        setError('Cannot unstake at this time. Lock period may not be over or trade is still active.');
        return;
      }
      
      await writeContractAsync({
        address: CONTRACT_ADDRESSES.WORLD_STAKING as `0x${string}`,
        abi: WORLD_STAKING_ABI,
        functionName: 'unstake',
        args: [BigInt(index)],
      });
      
      // Trigger a refresh of stakes
      setRefreshTrigger(prev => prev + 1);
      
    } catch (err) {
      console.error('Error unstaking:', err);
      setError('Failed to unstake. Please try again.');
    } finally {
      setUnstaking(null);
    }
  };

  // Handle claiming rewards
  const handleClaimRewards = async () => {
    if (!address) return;
    
    try {
      // Check if rewards can be claimed
      if (canClaimRewardsData === false) {
        if (dayOfWeek !== undefined && dayOfWeek !== 0n) {
          setError('Rewards can only be claimed on Sundays. Today is not Sunday.');
        } else {
          setError('Cannot claim rewards yet. Lock period may not be over or it\'s not the first Sunday after lock-in.');
        }
        return;
      }
      
      await writeContractAsync({
        address: CONTRACT_ADDRESSES.WORLD_STAKING as `0x${string}`,
        abi: WORLD_STAKING_ABI,
        functionName: 'claimRewards',
        args: [],
      });
      
      // Trigger a refresh of stakes
      setRefreshTrigger(prev => prev + 1);
      
    } catch (err) {
      console.error('Error claiming rewards:', err);
      setError('Failed to claim rewards. Make sure it is Sunday and lock period is over.');
    }
  };

  // Calculate total claimable rewards from all stakes (active and inactive)
  const totalClaimableRewards = stakes.reduce(
    (total, stake) => total + stake.claimableRewards,
    0n
  );

  // Force refresh canUnstake status
  const refreshCanUnstakeStatus = async () => {
    if (!address || !stakes.length) return;
    
    try {
      const publicClient = createPublicClient({
        chain: worldChainSepolia,
        transport: http()
      });
      
      const newCanUnstakeMap: Record<number, boolean> = {};
      
      for (const stake of stakes) {
        try {
          const canUnstake = await publicClient.readContract({
            address: CONTRACT_ADDRESSES.WORLD_STAKING as `0x${string}`,
            abi: WORLD_STAKING_ABI,
            functionName: 'canUnstake',
            args: [address, BigInt(stake.index)]
          }) as boolean;
          
          newCanUnstakeMap[stake.index] = canUnstake;
        } catch (err) {
          console.error(`Error checking if stake ${stake.index} can be unstaked:`, err);
          newCanUnstakeMap[stake.index] = false;
        }
      }
      
      setCanUnstakeMap(newCanUnstakeMap);
    } catch (err) {
      console.error('Error refreshing canUnstake status:', err);
    }
  };
  
  // Add a button to manually refresh the canUnstake status
  useEffect(() => {
    if (stakes.length > 0) {
      refreshCanUnstakeStatus();
    }
  }, [stakes, address]);

  // Separate stakes into active and inactive
  const activeStakes = stakes.filter(stake => stake.active);
  const inactiveStakes = stakes.filter(stake => !stake.active);

  if (loading) {
    return <div className="text-center py-8">Loading stakes...</div>;
  }

  if (error) {
    return (
      <div className="bg-red-900/50 border border-red-700 rounded p-4 my-4">
        <p>{error}</p>
        <button 
          onClick={() => setError(null)}
          className="mt-2 text-sm text-red-300 hover:text-red-200"
        >
          Dismiss
        </button>
      </div>
    );
  }

  if (!stakes.length) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 shadow-lg text-center">
        <p>You don't have any active stakes yet.</p>
        <p className="text-sm text-gray-400 mt-2">
          {stakeCount !== undefined ? `Stake count: ${stakeCount}` : 'No stake count available'}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
      <h2 className="text-xl font-bold mb-4">Your Stakes</h2>
      
      <div className="mb-4 flex justify-end">
        <button
          onClick={refreshCanUnstakeStatus}
          className="text-sm bg-blue-900 hover:bg-blue-800 text-white px-3 py-1 rounded flex items-center gap-1 mr-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh Status
        </button>
        
        <button
          onClick={() => setRefreshTrigger(prev => prev + 1)}
          className="text-sm bg-purple-900 hover:bg-purple-800 text-white px-3 py-1 rounded flex items-center gap-1"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Reload Stakes
        </button>
      </div>
      
      <div className="mb-4 p-4 bg-gray-700/30 border border-gray-600 rounded">
        <h3 className="text-sm font-medium mb-2">Debug Info</h3>
        <p className="text-xs text-gray-400">Total Stakes: {stakes.length}</p>
        <p className="text-xs text-gray-400">Active Stakes: {activeStakes.length}</p>
        <p className="text-xs text-gray-400">Inactive Stakes: {inactiveStakes.length}</p>
        <p className="text-xs text-gray-400">Day of Week: {dayOfWeek?.toString() || 'Unknown'} (0 = Sunday)</p>
        <p className="text-xs text-gray-400">Can Claim Rewards: {canClaimRewardsData !== undefined && canClaimRewardsData !== null ? canClaimRewardsData.toString() : 'Unknown'}</p>
      </div>
      
      {totalClaimableRewards > 0 && (
        <div className="mb-6 p-4 bg-green-900/30 border border-green-700 rounded">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-medium">Claimable Rewards</h3>
              <p className="text-green-400 text-lg font-bold">
                {formatBigInt(totalClaimableRewards)} RWD
              </p>
              {dayOfWeek !== undefined && dayOfWeek !== 0n && (
                <p className="text-xs text-amber-400 mt-1">
                  Rewards can only be claimed on Sundays. Today is day {dayOfWeek?.toString()} of the week.
                </p>
              )}
              {!canClaimRewardsData && dayOfWeek === 0n && (
                <p className="text-xs text-amber-400 mt-1">
                  Rewards cannot be claimed yet. Lock period may not be over or it's not the first Sunday after lock-in.
                </p>
              )}
            </div>
            <button
              onClick={handleClaimRewards}
              disabled={canClaimRewardsData === false}
              className={`${
                canClaimRewardsData === false
                  ? 'bg-green-900/50 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-700'
              } text-white px-4 py-2 rounded`}
            >
              Claim Rewards
            </button>
          </div>
        </div>
      )}
      
      {totalClaimableRewards === 0n && (
        <div className="mb-6 p-4 bg-gray-800/50 border border-gray-700 rounded">
          <h3 className="font-medium">Rewards Information</h3>
          <p className="text-sm text-gray-400 mt-1">
            You don't have any claimable rewards at the moment.
          </p>
          <p className="text-xs text-gray-500 mt-2">
            Rewards are generated when trades are profitable. When you unstake, any rewards are reset to zero and will need to be claimed on Sunday.
          </p>
        </div>
      )}
      
      {activeStakes.length > 0 && (
        <div className="space-y-4 mb-6">
          <h3 className="text-lg font-medium text-gray-300 mb-2">Active Stakes</h3>
          {activeStakes.map((stake) => (
            <div 
              key={stake.index} 
              className="border border-gray-700 rounded-lg p-4"
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium">Stake #{stake.index + 1}</h3>
                  </div>
                  <p className="text-lg font-bold">{formatBigInt(stake.amount)} WST</p>
                  <p className="text-sm text-gray-400">
                    Staked on: {formatTimestamp(Number(stake.timestamp))}
                  </p>
                  
                  <p className="text-sm mt-2">
                    Lock period: {formatTimeRemaining(Number(stake.timestamp) + 10 * 60)}
                  </p>
                  
                  <div className="mt-3 p-3 bg-gray-700/50 rounded">
                    <p className="text-sm font-medium">Trading Status</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`inline-block w-2 h-2 rounded-full ${
                        stake.tradeActive ? 'bg-green-500' : 'bg-gray-500'
                      }`}></span>
                      <span>{stake.tradeActive ? 'Active' : 'Completed'}</span>
                    </div>
                    <div className="mt-2">
                      <div className="flex justify-between text-sm">
                        <span>Initial</span>
                        <span>{formatBigInt(stake.tradingAmount)} WST</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Current</span>
                        <span className={`${
                          stake.currentTradeValue > stake.tradingAmount 
                            ? 'text-green-400' 
                            : stake.currentTradeValue < stake.tradingAmount 
                              ? 'text-red-400' 
                              : ''
                        }`}>
                          {formatBigInt(stake.currentTradeValue)} WST
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {stake.claimableRewards > 0 && (
                    <div className="mt-2">
                      <p className="text-green-400">
                        Rewards: {formatBigInt(stake.claimableRewards)} RWD
                      </p>
                    </div>
                  )}
                </div>
                
                <button
                  onClick={() => handleUnstake(stake.index)}
                  disabled={unstaking === stake.index || stake.tradeActive || !canUnstakeMap[stake.index]}
                  className={`px-4 py-2 rounded ${
                    unstaking === stake.index
                      ? 'bg-blue-800 cursor-not-allowed'
                      : stake.tradeActive
                        ? 'bg-gray-700 cursor-not-allowed'
                        : !canUnstakeMap[stake.index]
                          ? 'bg-gray-700 cursor-not-allowed'
                          : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {unstaking === stake.index ? 'Unstaking...' : 'Unstake'}
                </button>
              </div>
              
              {stake.tradeActive && (
                <p className="mt-3 text-xs text-amber-400">
                  Note: You cannot unstake while trading is active. Wait for the trade to complete.
                </p>
              )}
              
              {!stake.tradeActive && !canUnstakeMap[stake.index] && (
                <div className="mt-3 text-xs">
                  <p className="text-amber-400">
                    Note: You cannot unstake yet. The lock-in period of 10 minutes may not be over.
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-gray-400">Status:</span>
                    <span className="px-2 py-0.5 rounded bg-yellow-900/50 text-yellow-300 text-xs">
                      Checking eligibility...
                    </span>
                    <button 
                      onClick={refreshCanUnstakeStatus}
                      className="text-blue-400 hover:text-blue-300 text-xs"
                    >
                      Refresh
                    </button>
                  </div>
                </div>
              )}
              
              {!stake.tradeActive && canUnstakeMap[stake.index] && (
                <div className="mt-3 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">Status:</span>
                    <span className="px-2 py-0.5 rounded bg-green-900/50 text-green-300 text-xs">
                      Ready to unstake
                    </span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      
      {inactiveStakes.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-300 mb-2">Unstaked Positions</h3>
          {inactiveStakes.map((stake) => (
            <div 
              key={stake.index} 
              className={`border rounded-lg p-4 ${
                stake.claimableRewards > 0 
                  ? 'border-green-700 bg-green-900/20' 
                  : 'border-gray-700 bg-gray-900/20'
              }`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium">Stake #{stake.index + 1}</h3>
                    <span className={`px-2 py-0.5 text-xs rounded ${
                      stake.claimableRewards > 0 
                        ? 'bg-green-900 text-green-300' 
                        : 'bg-gray-800 text-gray-300'
                    }`}>
                      Unstaked
                    </span>
                  </div>
                  
                  {stake.timestamp > 0n ? (
                    <p className="text-sm text-gray-400">
                      Originally staked on: {formatTimestamp(Number(stake.timestamp))}
                    </p>
                  ) : (
                    <p className="text-sm text-gray-400">
                      Staking date not available (older contract version)
                    </p>
                  )}
                  
                  <div className="mt-3 p-3 bg-gray-800/30 rounded">
                    {stake.claimableRewards > 0 ? (
                      <>
                        <p className="text-sm font-medium text-green-400">
                          Available Rewards: {formatBigInt(stake.claimableRewards)} RWD
                        </p>
                        <p className="text-xs mt-1 text-green-300/70">
                          These rewards can be claimed on Sunday!
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-sm font-medium text-gray-400">
                          No rewards available from this stake.
                        </p>
                        <p className="text-xs mt-1 text-gray-500">
                          Either no profit was made or rewards were already claimed.
                        </p>
                      </>
                    )}
                  </div>
                  
                  {stake.tradingAmount > 0n && (
                    <div className="mt-2 text-xs text-gray-500">
                      <div className="flex justify-between">
                        <span>Trading amount:</span>
                        <span>{formatBigInt(stake.tradingAmount)} WST</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Final value:</span>
                        <span className={`${
                          stake.currentTradeValue > stake.tradingAmount 
                            ? 'text-green-400' 
                            : stake.currentTradeValue < stake.tradingAmount 
                              ? 'text-red-400' 
                              : ''
                        }`}>
                          {formatBigInt(stake.currentTradeValue)} WST
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 