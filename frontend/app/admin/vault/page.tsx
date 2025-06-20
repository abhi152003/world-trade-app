'use client';

import { useState, useEffect } from 'react';
import { useAccount, useWriteContract } from 'wagmi';
import { createPublicClient, http } from 'viem';
import { worldChainMainnet } from '../../constants/chains';
import { CONTRACT_ADDRESSES, VAULT_MANAGER_ABI, ERC20_ABI } from '../../constants/contracts';
import { formatBigInt } from '../../utils/format';
import Link from 'next/link';

type DepositInfo = {
  user: `0x${string}`;
  depositId: number;
  depositedAmount: bigint;
  withdrawableAmount: bigint;
  depositTimestamp: bigint;
  active: boolean;
};

export default function VaultAdminPage() {
  const { address, isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const [deposits, setDeposits] = useState<DepositInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingDeposit, setUpdatingDeposit] = useState<string | null>(null);
  const [searchUser, setSearchUser] = useState('');
  const [contractStats, setContractStats] = useState({
    totalDeposited: BigInt(0),
    totalWithdrawable: BigInt(0),
    contractBalance: BigInt(0)
  });
  const [newWithdrawableAmount, setNewWithdrawableAmount] = useState<{ [key: string]: string }>({});

  // Load all deposits and contract stats
  useEffect(() => {
    async function loadDepositsAndStats() {
      if (!isConnected) return;
      
      try {
        setLoading(true);
        const allDeposits: DepositInfo[] = [];
        
        // Create a public client for direct contract calls
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
        
        setContractStats({
          totalDeposited: totalDeposited as bigint,
          totalWithdrawable: totalWithdrawable as bigint,
          contractBalance: contractBalance as bigint
        });
        
        // Get all deposit events to find users
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
        
        // Process each user's deposits
        const processedUserDeposits = new Set<string>();
        
        for (const event of depositEvents) {
          const user = event.args.user as `0x${string}`;
          const userDepositKey = `${user}`;
          
          // Skip if we've already processed this user
          if (processedUserDeposits.has(userDepositKey)) continue;
          processedUserDeposits.add(userDepositKey);
          
          // Get deposit count for this user
          const depositCount = await publicClient.readContract({
            address: CONTRACT_ADDRESSES.VAULT_MANAGER as `0x${string}`,
            abi: VAULT_MANAGER_ABI,
            functionName: 'getUserDepositCount',
            args: [user]
          }) as bigint;
          
          // Check each deposit
          for (let i = 0; i < Number(depositCount); i++) {
            try {
              // Get deposit details
              const depositDetails = await publicClient.readContract({
                address: CONTRACT_ADDRESSES.VAULT_MANAGER as `0x${string}`,
                abi: VAULT_MANAGER_ABI,
                functionName: 'getDepositDetails',
                args: [user, BigInt(i)]
              }) as [bigint, bigint, bigint, boolean];
              
              const [depositedAmount, withdrawableAmount, depositTimestamp, active] = depositDetails;
              
              allDeposits.push({
                user,
                depositId: i,
                depositedAmount,
                withdrawableAmount,
                depositTimestamp,
                active,
              });
            } catch (err) {
              console.error(`Error processing deposit ${i} for user ${user}:`, err);
            }
          }
        }
        
        // Sort by most recent deposits first
        allDeposits.sort((a, b) => Number(b.depositTimestamp) - Number(a.depositTimestamp));
        setDeposits(allDeposits);
        
      } catch (err) {
        console.error('Error loading deposits:', err);
        setError('Failed to load deposits');
      } finally {
        setLoading(false);
      }
    }
    
    loadDepositsAndStats();
  }, [isConnected]);

  // Handle updating withdrawable amount
  const handleUpdateWithdrawableAmount = async (deposit: DepositInfo) => {
    const depositKey = `${deposit.user}-${deposit.depositId}`;
    const newAmount = newWithdrawableAmount[depositKey];
    
    if (!newAmount || parseFloat(newAmount) < 0) {
      setError('Please enter a valid withdrawable amount');
      return;
    }
    
    try {
      setUpdatingDeposit(depositKey);
      
      // Convert to Wei (18 decimals)
      const newAmountWei = BigInt(Math.floor(parseFloat(newAmount) * 1e18));
      
      await writeContractAsync({
        address: CONTRACT_ADDRESSES.VAULT_MANAGER as `0x${string}`,
        abi: VAULT_MANAGER_ABI,
        functionName: 'updateWithdrawableAmount',
        args: [deposit.user, BigInt(deposit.depositId), newAmountWei],
      });
      
      // Update the local state
      setDeposits(prevDeposits => 
        prevDeposits.map(d => 
          (d.user === deposit.user && d.depositId === deposit.depositId)
            ? { ...d, withdrawableAmount: newAmountWei }
            : d
        )
      );
      
      // Clear the input
      setNewWithdrawableAmount(prev => ({ ...prev, [depositKey]: '' }));
      
    } catch (err) {
      console.error('Error updating withdrawable amount:', err);
      setError('Failed to update withdrawable amount');
    } finally {
      setUpdatingDeposit(null);
    }
  };

  // Filter deposits based on search
  const filteredDeposits = deposits.filter(deposit => {
    if (!searchUser) return true;
    return deposit.user.toLowerCase().includes(searchUser.toLowerCase());
  });

  // Helper function to format timestamp
  const formatTimestamp = (timestamp: bigint): string => {
    const date = new Date(Number(timestamp) * 1000);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8">
        <h1 className="text-2xl font-bold mb-4">Vault Admin Dashboard</h1>
        <div className="bg-gray-800 rounded-lg p-6">
          <p>Please connect your wallet to access the vault admin dashboard.</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Vault Admin Dashboard</h1>
          <p className="text-gray-400">Manage VaultManagerPermit2 deposits and withdrawable amounts</p>
        </div>
        <div className="flex gap-4">
          <Link href="/admin" className="text-blue-400 hover:text-blue-300">
            Staking Admin
          </Link>
          <Link href="/" className="text-blue-400 hover:text-blue-300">
            Back to Home
          </Link>
        </div>
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

      {/* Contract Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-sm font-medium text-gray-400 mb-2">Total Deposited</h3>
          <p className="text-2xl font-bold text-green-400">{formatBigInt(contractStats.totalDeposited)} WLD</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-sm font-medium text-gray-400 mb-2">Total Withdrawable</h3>
          <p className="text-2xl font-bold text-yellow-400">{formatBigInt(contractStats.totalWithdrawable)} WLD</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-sm font-medium text-gray-400 mb-2">Contract Balance</h3>
          <p className="text-2xl font-bold text-blue-400">{formatBigInt(contractStats.contractBalance)} WLD</p>
        </div>
      </div>
      
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">All Deposits</h2>
          <div className="flex gap-4 items-center">
            <input
              type="text"
              placeholder="Search by user address..."
              value={searchUser}
              onChange={(e) => setSearchUser(e.target.value)}
              className="px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400"
            />
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded"
            >
              Refresh
            </button>
          </div>
        </div>
        
        {loading ? (
          <p>Loading deposits...</p>
        ) : filteredDeposits.length === 0 ? (
          <p>No deposits found.</p>
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
                  <th className="text-left py-2">Deposit Date</th>
                  <th className="text-left py-2">Update Withdrawable</th>
                  <th className="text-left py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredDeposits.map((deposit) => {
                  const depositKey = `${deposit.user}-${deposit.depositId}`;
                  const isUpdating = updatingDeposit === depositKey;
                  
                  return (
                    <tr key={depositKey} className="border-b border-gray-700">
                      <td className="py-3 font-mono text-xs">
                        <span title={deposit.user}>
                          {`${deposit.user.slice(0, 6)}...${deposit.user.slice(-4)}`}
                        </span>
                      </td>
                      <td className="py-3">{deposit.depositId}</td>
                      <td className="py-3">{formatBigInt(deposit.depositedAmount)} WLD</td>
                      <td className="py-3 font-semibold">
                        {formatBigInt(deposit.withdrawableAmount)} WLD
                      </td>
                      <td className="py-3">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          deposit.active 
                            ? 'bg-green-900/50 text-green-400' 
                            : 'bg-gray-600 text-gray-400'
                        }`}>
                          {deposit.active ? 'Active' : 'Withdrawn'}
                        </span>
                      </td>
                      <td className="py-3 text-xs">{formatTimestamp(deposit.depositTimestamp)}</td>
                      <td className="py-3">
                        <div className="flex gap-2 items-center">
                          <input
                            type="number"
                            step="0.000001"
                            min="0"
                            placeholder="New amount"
                            value={newWithdrawableAmount[depositKey] || ''}
                            onChange={(e) => setNewWithdrawableAmount(prev => ({
                              ...prev,
                              [depositKey]: e.target.value
                            }))}
                            disabled={!deposit.active || isUpdating}
                            className="px-2 py-1 text-xs bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 w-24"
                          />
                          <span className="text-xs text-gray-400">WLD</span>
                        </div>
                      </td>
                      <td className="py-3">
                        <button
                          onClick={() => handleUpdateWithdrawableAmount(deposit)}
                          disabled={
                            !deposit.active || 
                            isUpdating || 
                            !newWithdrawableAmount[depositKey] ||
                            parseFloat(newWithdrawableAmount[depositKey] || '0') < 0
                          }
                          className={`px-3 py-1 text-xs rounded ${
                            isUpdating
                              ? 'bg-blue-800 cursor-not-allowed'
                              : !deposit.active
                              ? 'bg-gray-600 cursor-not-allowed'
                              : 'bg-blue-600 hover:bg-blue-700'
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
        
        <div className="mt-6 p-4 bg-gray-700/30 border border-gray-600 rounded">
          <h3 className="text-sm font-medium mb-2">Admin Functions</h3>
          <div className="text-xs text-gray-400 space-y-1">
            <p><span className="text-blue-400">Update Withdrawable Amount:</span> Change how much a user can withdraw from their deposit</p>
            <p><span className="text-yellow-400">Note:</span> Only active deposits can be updated</p>
            <p><span className="text-green-400">Tip:</span> You can set the withdrawable amount higher or lower than the deposited amount</p>
            <p><span className="text-red-400">Warning:</span> Ensure the contract has sufficient balance to cover withdrawals</p>
          </div>
        </div>
      </div>
    </div>
  );
} 