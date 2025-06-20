'use client';

import { useState, useEffect } from 'react';
import { useAccount, useWriteContract } from 'wagmi';
import { createPublicClient, http } from 'viem';
import { worldChainMainnet } from '../constants/chains';
import { CONTRACT_ADDRESSES, WORLD_STAKING_ABI, VAULT_MANAGER_ABI } from '../constants/contracts';
import { formatBigInt } from '../utils/format';
import { simulatePriceMovement } from '../utils/tradeSimulator';
import Link from 'next/link';

type ActiveTrade = {
  user: `0x${string}`;
  stakeIndex: number;
  amount: bigint;
  tradingAmount: bigint;
  currentTradeValue: bigint;
};

export default function AdminPage() {
  const { address, isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const [activeTrades, setActiveTrades] = useState<ActiveTrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingTrade, setUpdatingTrade] = useState<string | null>(null);
  const [exitingTrade, setExitingTrade] = useState<string | null>(null);
  
  // Load active trades
  useEffect(() => {
    async function loadActiveTrades() {
      if (!isConnected) return;
      
      try {
        setLoading(true);
        const trades: ActiveTrade[] = [];
        
        // Create a public client for direct contract calls
        const publicClient = createPublicClient({
          chain: worldChainMainnet,
          transport: http()
        });
        
        // Get all users with active stakes from events (simplified approach)
        const stakedEvents = await publicClient.getLogs({
          address: CONTRACT_ADDRESSES.WORLD_STAKING as `0x${string}`,
          event: {
            type: 'event',
            name: 'Staked',
            inputs: [
              { type: 'address', name: 'user', indexed: true },
              { type: 'uint256', name: 'amount' },
              { type: 'uint256', name: 'tradingAmount' },
              { type: 'uint256', name: 'timestamp' }
            ]
          },
          fromBlock: 'earliest'
        });
        
        // Process each user's stakes
        const processedUsers = new Set<string>();
        
        for (const event of stakedEvents) {
          const user = event.args.user as `0x${string}`;
          
          // Skip if we've already processed this user
          if (processedUsers.has(user)) continue;
          processedUsers.add(user);
          
          // Get stake count for this user
          const stakeCount = await publicClient.readContract({
            address: CONTRACT_ADDRESSES.WORLD_STAKING as `0x${string}`,
            abi: WORLD_STAKING_ABI,
            functionName: 'getStakeCount',
            args: [user]
          }) as bigint;
          
          // Check each stake
          for (let i = 0; i < Number(stakeCount); i++) {
            try {
              // Get stake details
              const stakeDetails = await publicClient.readContract({
                address: CONTRACT_ADDRESSES.WORLD_STAKING as `0x${string}`,
                abi: WORLD_STAKING_ABI,
                functionName: 'getStakeDetails',
                args: [user, BigInt(i)]
              }) as any[];
              
              const active = stakeDetails[6] as boolean;
              const tradeActive = stakeDetails[4] as boolean;
              
              if (active && tradeActive) {
                trades.push({
                  user,
                  stakeIndex: i,
                  amount: stakeDetails[0] as bigint,
                  tradingAmount: stakeDetails[2] as bigint,
                  currentTradeValue: stakeDetails[3] as bigint,
                });
              }
            } catch (err) {
              console.error(`Error processing stake ${i} for user ${user}:`, err);
            }
          }
        }
        
        setActiveTrades(trades);
      } catch (err) {
        console.error('Error loading active trades:', err);
        setError('Failed to load active trades');
      } finally {
        setLoading(false);
      }
    }
    
    loadActiveTrades();
  }, [isConnected]);
  
  // Handle updating a trade value
  const handleUpdateTradeValue = async (trade: ActiveTrade) => {
    try {
      setUpdatingTrade(`${trade.user}-${trade.stakeIndex}`);
      
      // Generate a new trade value
      const newValue = simulatePriceMovement(trade.currentTradeValue);
      
      await writeContractAsync({
        address: CONTRACT_ADDRESSES.WORLD_STAKING as `0x${string}`,
        abi: WORLD_STAKING_ABI,
        functionName: 'updateTradeValue',
        args: [trade.user, BigInt(trade.stakeIndex), newValue],
      });
      
      // Update the local state
      setActiveTrades(prevTrades => 
        prevTrades.map(t => 
          (t.user === trade.user && t.stakeIndex === trade.stakeIndex)
            ? { ...t, currentTradeValue: newValue }
            : t
        )
      );
      
    } catch (err) {
      console.error('Error updating trade value:', err);
      setError('Failed to update trade value');
    } finally {
      setUpdatingTrade(null);
    }
  };
  
  // Handle exiting a trade with hardcoded values
  const handleExitTrade = async (trade: ActiveTrade, profitable: boolean) => {
    try {
      setExitingTrade(`${trade.user}-${trade.stakeIndex}`);
      
      // Calculate final value based on whether we want it to be profitable
      let finalValue = trade.currentTradeValue;
      
      if (profitable) {
        // Make it profitable (10-20% profit)
        const profitPercentage = 10 + Math.random() * 10;
        finalValue = trade.tradingAmount + BigInt(Math.floor(Number(trade.tradingAmount) * profitPercentage / 100));
      } else {
        // Make it unprofitable (0-10% loss)
        const lossPercentage = Math.random() * 10;
        finalValue = trade.tradingAmount - BigInt(Math.floor(Number(trade.tradingAmount) * lossPercentage / 100));
      }
      
      await writeContractAsync({
        address: CONTRACT_ADDRESSES.WORLD_STAKING as `0x${string}`,
        abi: WORLD_STAKING_ABI,
        functionName: 'exitTrade',
        args: [trade.user, BigInt(trade.stakeIndex), finalValue],
      });
      
      // Remove from active trades
      setActiveTrades(prevTrades => 
        prevTrades.filter(t => 
          !(t.user === trade.user && t.stakeIndex === trade.stakeIndex)
        )
      );
      
    } catch (err) {
      console.error('Error exiting trade:', err);
      setError('Failed to exit trade');
    } finally {
      setExitingTrade(null);
    }
  };

  // Handle exiting a trade at current value (set by cron job)
  const handleExitTradeAtCurrentValue = async (trade: ActiveTrade) => {
    try {
      setExitingTrade(`${trade.user}-${trade.stakeIndex}`);
      
      // Exit at the current trade value that was set by the cron job
      const finalValue = trade.currentTradeValue;
      
      console.log(`Exiting trade at current value: ${finalValue} (set by cron job)`);
      
      await writeContractAsync({
        address: CONTRACT_ADDRESSES.WORLD_STAKING as `0x${string}`,
        abi: WORLD_STAKING_ABI,
        functionName: 'exitTrade',
        args: [trade.user, BigInt(trade.stakeIndex), finalValue],
      });
      
      // Remove from active trades
      setActiveTrades(prevTrades => 
        prevTrades.filter(t => 
          !(t.user === trade.user && t.stakeIndex === trade.stakeIndex)
        )
      );
      
    } catch (err) {
      console.error('Error exiting trade at current value:', err);
      setError('Failed to exit trade at current value');
    } finally {
      setExitingTrade(null);
    }
  };
  
  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8">
        <h1 className="text-2xl font-bold mb-4">Admin Dashboard</h1>
        <div className="bg-gray-800 rounded-lg p-6">
          <p>Please connect your wallet to access the admin dashboard.</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <p className="text-gray-400">Manage trades and vault deposits</p>
        </div>
        <Link href="/" className="text-blue-400 hover:text-blue-300">
          Back to Home
        </Link>
      </div>
      
      {error && (
        <div className="bg-red-900/50 border border-red-700 rounded p-4 mb-4">
          <p>{error}</p>
          <button 
            onClick={() => setError(null)}
            className="mt-2 text-sm text-red-300 hover:text-red-200"
          >
            Dismiss
          </button>
        </div>
      )}
      
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4">Active Trades</h2>
        
        {loading ? (
          <p>Loading active trades...</p>
        ) : activeTrades.length === 0 ? (
          <p>No active trades found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-2">User</th>
                  <th className="text-left py-2">Stake #</th>
                  <th className="text-left py-2">Amount</th>
                  <th className="text-left py-2">Trading Amount</th>
                  <th className="text-left py-2">Current Value</th>
                  <th className="text-left py-2">P/L</th>
                  <th className="text-left py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {activeTrades.map((trade) => {
                  const tradeKey = `${trade.user}-${trade.stakeIndex}`;
                  const isUpdating = updatingTrade === tradeKey;
                  const isExiting = exitingTrade === tradeKey;
                  const profitLoss = Number(trade.currentTradeValue) - Number(trade.tradingAmount);
                  const profitLossPercentage = (profitLoss / Number(trade.tradingAmount)) * 100;
                  
                  return (
                    <tr key={tradeKey} className="border-b border-gray-700">
                      <td className="py-3 font-mono text-xs">
                        {`${trade.user.slice(0, 6)}...${trade.user.slice(-4)}`}
                      </td>
                      <td className="py-3">{trade.stakeIndex}</td>
                      <td className="py-3">{formatBigInt(trade.amount)} WST</td>
                      <td className="py-3">{formatBigInt(trade.tradingAmount)} WST</td>
                      <td className="py-3">{formatBigInt(trade.currentTradeValue)} WST</td>
                      <td className={`py-3 ${profitLoss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {profitLoss >= 0 ? '+' : ''}{profitLossPercentage.toFixed(2)}%
                      </td>
                      <td className="py-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleUpdateTradeValue(trade)}
                            disabled={isUpdating || isExiting}
                            className={`px-2 py-1 text-xs rounded ${
                              isUpdating
                                ? 'bg-blue-800 cursor-not-allowed'
                                : 'bg-blue-600 hover:bg-blue-700'
                            }`}
                          >
                            {isUpdating ? 'Updating...' : 'Update Value'}
                          </button>
                          <button
                            onClick={() => handleExitTradeAtCurrentValue(trade)}
                            disabled={isUpdating || isExiting}
                            className={`px-2 py-1 text-xs rounded ${
                              isExiting
                                ? 'bg-purple-800 cursor-not-allowed'
                                : 'bg-purple-600 hover:bg-purple-700'
                            }`}
                            title="Exit at the current value set by cron job"
                          >
                            Exit (Current)
                          </button>
                          <button
                            onClick={() => handleExitTrade(trade, true)}
                            disabled={isUpdating || isExiting}
                            className={`px-2 py-1 text-xs rounded ${
                              isExiting
                                ? 'bg-green-800 cursor-not-allowed'
                                : 'bg-green-600 hover:bg-green-700'
                            }`}
                          >
                            Exit (Profit)
                          </button>
                          <button
                            onClick={() => handleExitTrade(trade, false)}
                            disabled={isUpdating || isExiting}
                            className={`px-2 py-1 text-xs rounded ${
                              isExiting
                                ? 'bg-red-800 cursor-not-allowed'
                                : 'bg-red-600 hover:bg-red-700'
                            }`}
                          >
                            Exit (Loss)
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        
        <div className="mt-6">
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded"
          >
            Refresh Trades
          </button>
        </div>
        
        <div className="mt-4 p-4 bg-gray-700/30 border border-gray-600 rounded">
          <h3 className="text-sm font-medium mb-2">Button Descriptions</h3>
          <div className="text-xs text-gray-400 space-y-1">
            <p><span className="text-blue-400">Update Value:</span> Randomly simulates price movement</p>
            <p><span className="text-purple-400">Exit (Current):</span> Exits trade at the current value set by the cron job signal processing</p>
            <p><span className="text-green-400">Exit (Profit):</span> Exits with hardcoded profit (10-20%)</p>
            <p><span className="text-red-400">Exit (Loss):</span> Exits with hardcoded loss (0-10%)</p>
          </div>
        </div>
      </div>

      {/* Vault Manager Admin Section */}
      <VaultManagerAdmin />
    </div>
  );
}

// Vault Manager Admin Component
function VaultManagerAdmin() {
  const { writeContractAsync } = useWriteContract();
  const [vaultDeposits, setVaultDeposits] = useState<any[]>([]);
  const [loadingVault, setLoadingVault] = useState(true);
  const [vaultError, setVaultError] = useState<string | null>(null);
  const [updatingVaultDeposit, setUpdatingVaultDeposit] = useState<string | null>(null);
  const [searchVaultUser, setSearchVaultUser] = useState('');
  const [vaultStats, setVaultStats] = useState({
    totalDeposited: BigInt(0),
    totalWithdrawable: BigInt(0),
    contractBalance: BigInt(0)
  });
  const [newVaultWithdrawableAmount, setNewVaultWithdrawableAmount] = useState<{ [key: string]: string }>({});

  // Load vault deposits and stats
  useEffect(() => {
    async function loadVaultData() {
      try {
        setLoadingVault(true);
        const allVaultDeposits: any[] = [];
        
        const publicClient = createPublicClient({
          chain: worldChainMainnet,
          transport: http()
        });
        
        // Get contract stats
        const [totalDeposited, totalWithdrawable, contractBalance] = await Promise.all([
          publicClient.readContract({
            address: CONTRACT_ADDRESSES.VAULT_MANAGER as `0x${string}`,
            abi: VAULT_MANAGER_ABI,
            functionName: 'totalDeposited'
          }),
          publicClient.readContract({
            address: CONTRACT_ADDRESSES.VAULT_MANAGER as `0x${string}`,
            abi: VAULT_MANAGER_ABI,
            functionName: 'totalWithdrawable'
          }),
          publicClient.readContract({
            address: CONTRACT_ADDRESSES.VAULT_MANAGER as `0x${string}`,
            abi: VAULT_MANAGER_ABI,
            functionName: 'getContractBalance'
          })
        ]);
        
        setVaultStats({
          totalDeposited: totalDeposited as bigint,
          totalWithdrawable: totalWithdrawable as bigint,
          contractBalance: contractBalance as bigint
        });
        
        // Try to get deposit events
        try {
          const depositEvents = await publicClient.getLogs({
            address: CONTRACT_ADDRESSES.VAULT_MANAGER as `0x${string}`,
            event: {
              type: 'event',
              name: 'Deposited',
              inputs: [
                { type: 'address', name: 'user', indexed: true },
                { type: 'uint256', name: 'depositId', indexed: true },
                { type: 'uint256', name: 'amount' },
                { type: 'uint256', name: 'timestamp' }
              ]
            },
            fromBlock: 'earliest'
          });
          
          const processedUsers = new Set<string>();
          
          for (const event of depositEvents) {
            const user = event.args.user as `0x${string}`;
            
            if (processedUsers.has(user)) continue;
            processedUsers.add(user);
            
            try {
              const depositCount = await publicClient.readContract({
                address: CONTRACT_ADDRESSES.VAULT_MANAGER as `0x${string}`,
                abi: VAULT_MANAGER_ABI,
                functionName: 'getUserDepositCount',
                args: [user]
              }) as bigint;
              
              for (let i = 0; i < Number(depositCount); i++) {
                try {
                  const depositDetails = await publicClient.readContract({
                    address: CONTRACT_ADDRESSES.VAULT_MANAGER as `0x${string}`,
                    abi: VAULT_MANAGER_ABI,
                    functionName: 'getDepositDetails',
                    args: [user, BigInt(i)]
                  }) as [bigint, bigint, bigint, boolean];
                  
                  const [depositedAmount, withdrawableAmount, depositTimestamp, active] = depositDetails;
                  
                  allVaultDeposits.push({
                    user,
                    depositId: i,
                    depositedAmount,
                    withdrawableAmount,
                    depositTimestamp,
                    active,
                  });
                } catch (err) {
                  console.error(`Error processing vault deposit ${i} for user ${user}:`, err);
                }
              }
            } catch (err) {
              console.error(`Error getting vault deposit count for user ${user}:`, err);
            }
          }
        } catch (err) {
          console.warn('Could not load vault deposits from events:', err);
        }
        
        allVaultDeposits.sort((a, b) => Number(b.depositTimestamp) - Number(a.depositTimestamp));
        setVaultDeposits(allVaultDeposits);
        
      } catch (err) {
        console.error('Error loading vault data:', err);
        setVaultError('Failed to load vault data');
      } finally {
        setLoadingVault(false);
      }
    }
    
    loadVaultData();
  }, []);

  // Handle updating vault withdrawable amount
  const handleUpdateVaultWithdrawableAmount = async (deposit: any) => {
    const depositKey = `${deposit.user}-${deposit.depositId}`;
    const newAmount = newVaultWithdrawableAmount[depositKey];
    
    if (!newAmount || parseFloat(newAmount) < 0) {
      setVaultError('Please enter a valid withdrawable amount');
      return;
    }
    
    try {
      setUpdatingVaultDeposit(depositKey);
      setVaultError(null);
      
      const newAmountWei = BigInt(Math.floor(parseFloat(newAmount) * 1e18));
      
      await writeContractAsync({
        address: CONTRACT_ADDRESSES.VAULT_MANAGER as `0x${string}`,
        abi: VAULT_MANAGER_ABI,
        functionName: 'updateWithdrawableAmount',
        args: [deposit.user, BigInt(deposit.depositId), newAmountWei],
      });
      
      setVaultDeposits(prevDeposits => 
        prevDeposits.map(d => 
          (d.user === deposit.user && d.depositId === deposit.depositId)
            ? { ...d, withdrawableAmount: newAmountWei }
            : d
        )
      );
      
      setNewVaultWithdrawableAmount(prev => ({ ...prev, [depositKey]: '' }));
      
    } catch (err) {
      console.error('Error updating vault withdrawable amount:', err);
      setVaultError('Failed to update withdrawable amount');
    } finally {
      setUpdatingVaultDeposit(null);
    }
  };

  const filteredVaultDeposits = vaultDeposits.filter(deposit => {
    if (!searchVaultUser) return true;
    return deposit.user.toLowerCase().includes(searchVaultUser.toLowerCase());
  });

  const formatTimestamp = (timestamp: bigint): string => {
    const date = new Date(Number(timestamp) * 1000);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6 mt-8">
      <h2 className="text-xl font-bold mb-4">Vault Manager Admin</h2>
      
      {vaultError && (
        <div className="bg-red-900/50 border border-red-700 rounded p-4 mb-4">
          <p>{vaultError}</p>
          <button 
            onClick={() => setVaultError(null)}
            className="mt-2 text-sm text-red-300 hover:text-red-200"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Vault Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-700 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-400 mb-2">Total Deposited</h3>
          <p className="text-xl font-bold text-green-400">{formatBigInt(vaultStats.totalDeposited)} WLD</p>
        </div>
        <div className="bg-gray-700 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-400 mb-2">Total Withdrawable</h3>
          <p className="text-xl font-bold text-yellow-400">{formatBigInt(vaultStats.totalWithdrawable)} WLD</p>
        </div>
        <div className="bg-gray-700 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-400 mb-2">Contract Balance</h3>
          <p className="text-xl font-bold text-blue-400">{formatBigInt(vaultStats.contractBalance)} WLD</p>
        </div>
      </div>
      
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Vault Deposits</h3>
        <input
          type="text"
          placeholder="Search by user address..."
          value={searchVaultUser}
          onChange={(e) => setSearchVaultUser(e.target.value)}
          className="px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400"
        />
      </div>
      
      {loadingVault ? (
        <p>Loading vault deposits...</p>
      ) : filteredVaultDeposits.length === 0 ? (
        <p>No vault deposits found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-2">User</th>
                <th className="text-left py-2">Deposit #</th>
                <th className="text-left py-2">Deposited</th>
                <th className="text-left py-2">Withdrawable</th>
                <th className="text-left py-2">Status</th>
                <th className="text-left py-2">Date</th>
                <th className="text-left py-2">Update Amount</th>
                <th className="text-left py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredVaultDeposits.map((deposit) => {
                const depositKey = `${deposit.user}-${deposit.depositId}`;
                const isUpdating = updatingVaultDeposit === depositKey;
                
                return (
                  <tr key={depositKey} className="border-b border-gray-700">
                    <td className="py-3 font-mono text-xs">
                      {`${deposit.user.slice(0, 6)}...${deposit.user.slice(-4)}`}
                    </td>
                    <td className="py-3">{deposit.depositId}</td>
                    <td className="py-3">{formatBigInt(deposit.depositedAmount)} WLD</td>
                    <td className="py-3 font-semibold">{formatBigInt(deposit.withdrawableAmount)} WLD</td>
                    <td className="py-3">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                        deposit.active ? 'bg-green-900/50 text-green-400' : 'bg-gray-600 text-gray-400'
                      }`}>
                        {deposit.active ? 'Active' : 'Withdrawn'}
                      </span>
                    </td>
                    <td className="py-3 text-xs">{formatTimestamp(deposit.depositTimestamp)}</td>
                    <td className="py-3">
                      <div className="flex gap-1 items-center">
                        <input
                          type="number"
                          step="0.000001"
                          min="0"
                          placeholder="Amount"
                          value={newVaultWithdrawableAmount[depositKey] || ''}
                          onChange={(e) => setNewVaultWithdrawableAmount(prev => ({
                            ...prev,
                            [depositKey]: e.target.value
                          }))}
                          disabled={!deposit.active || isUpdating}
                          className="px-2 py-1 text-xs bg-gray-700 border border-gray-600 rounded text-white w-20"
                        />
                        <span className="text-xs text-gray-400">WLD</span>
                      </div>
                    </td>
                    <td className="py-3">
                      <button
                        onClick={() => handleUpdateVaultWithdrawableAmount(deposit)}
                        disabled={
                          !deposit.active || 
                          isUpdating || 
                          !newVaultWithdrawableAmount[depositKey] ||
                          parseFloat(newVaultWithdrawableAmount[depositKey] || '0') < 0
                        }
                        className={`px-2 py-1 text-xs rounded ${
                          isUpdating
                            ? 'bg-purple-800 cursor-not-allowed'
                            : !deposit.active
                            ? 'bg-gray-600 cursor-not-allowed'
                            : 'bg-purple-600 hover:bg-purple-700'
                        }`}
                      >
                        {isUpdating ? 'Updating...' : 'Update'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      
      <div className="mt-4 p-4 bg-gray-700/30 border border-gray-600 rounded">
        <h4 className="text-sm font-medium mb-2">Vault Admin Functions</h4>
        <div className="text-xs text-gray-400 space-y-1">
          <p><span className="text-purple-400">Update Withdrawable Amount:</span> Control how much users can withdraw (backend simulation)</p>
          <p><span className="text-yellow-400">Use Case:</span> Simulate profit/loss by adjusting withdrawable amounts higher/lower than deposits</p>
          <p><span className="text-green-400">Example:</span> Set 0.0002 WLD withdrawable for a 0.0001 WLD deposit (100% profit)</p>
        </div>
      </div>
    </div>
  );
} 