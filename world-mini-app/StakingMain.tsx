'use client';
import React, { useState, useEffect } from 'react';
import { MiniKit } from '@worldcoin/minikit-js';
import { useWaitForTransactionReceipt } from '@worldcoin/minikit-react';
import { createPublicClient, http } from 'viem';
import { worldchain } from 'viem/chains';
import { CONTRACT_ADDRESSES, ERC20_ABI, WORLD_STAKING_ABI } from '../constants/contracts';
import { formatBigInt } from '../../utils/format';
import { useSession } from 'next-auth/react'
import { 
  Button, 
  LiveFeedback, 
  CircularIcon
} from '@worldcoin/mini-apps-ui-kit-react';
import { 
  Wallet, 
  Coins, 
  Gift, 
  Refresh, 
  Eye,
  Calendar,
  Clock,
  Dollar,
  Flash,
  Star,
  ShieldCheck,
  ArrowUp,
  ArrowDown,
} from 'iconoir-react';
// World Chain Mainnet configuration
const worldChainMainnet = {
  id: 480,
  name: 'World Chain',
  network: 'worldchain',
  nativeCurrency: {
    decimals: 18,
    name: 'Ether',
    symbol: 'ETH',
  },
  rpcUrls: {
    public: { http: ['https://worldchain-mainnet.g.alchemy.com/public'] },
    default: { http: ['https://worldchain-mainnet.g.alchemy.com/public'] },
  },
  blockExplorers: {
    default: { name: 'World Chain Explorer', url: 'https://worldscan.org/' },
  },
  testnet: false,
};

// Add interface for stake details
interface StakeDetails {
  amount: bigint;
  timestamp: bigint;
  tradingAmount: bigint;
  currentTradeValue: bigint;
  tradeActive: boolean;
  claimableRewards: bigint;
  active: boolean;
  index: number;
}

export function StakingFormMain() {
  const { data: session } = useSession();
  const [amount, setAmount] = useState('');
  const [isApproving, setIsApproving] = useState(false);
  const [isStaking, setIsStaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [balance, setBalance] = useState<bigint>(BigInt(0));
  const [permit2Allowance, setPermit2Allowance] = useState<bigint>(BigInt(0));
  const [walletAddress, setWalletAddress] = useState<string>('');
  const [transactionId, setTransactionId] = useState<string>('');

  // Add new state for withdrawal functionality
  const [stakes, setStakes] = useState<StakeDetails[]>([]);
  const [isWithdrawing, setIsWithdrawing] = useState<{ [key: number]: boolean }>({});
  const [isClaimingRewards, setIsClaimingRewards] = useState<{ [key: number]: boolean }>({});
  const [isLoadingStakes, setIsLoadingStakes] = useState(false);
  const [activeTab, setActiveTab] = useState<'stake' | 'withdraw'>('stake');
  const [currentTime, setCurrentTime] = useState(Math.floor(Date.now() / 1000));

  // Setup viem client for World Chain
  const client = createPublicClient({
    chain: worldChainMainnet,
    transport: http('https://worldchain-mainnet.g.alchemy.com/public'),
  });
  // Monitor transaction status
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    client: client,
    appConfig: {
      app_id: process.env.NEXT_PUBLIC_APP_ID || '<your_app_id>', // Replace with your actual app_id
    },
    transactionId: transactionId,
  });
  useEffect(() => {
    const setWalletAndFetchData = async () => {
      if (session?.user?.id) {
        try {
          console.log("session", session);
          console.log("session?.user?.id", session?.user?.id);
          
          // Use session.user.id directly as wallet address
          const walletAddr = session.user.id;
          
          setWalletAddress(walletAddr);
          
          // Fetch balance and allowance with the wallet address
          await fetchBalanceAndAllowanceWithAddress(walletAddr);
          
          // Also fetch user stakes
          await fetchUserStakesWithAddress(walletAddr);
        } catch (error) {
          console.error('Error setting wallet address:', error);
          setError('Failed to set wallet address');
        }
      }
    };
    setWalletAndFetchData();
  }, [session?.user?.id]); // Dependency on session user id
  // Refresh data when transaction is confirmed
  useEffect(() => {
    if (isConfirmed) {
      fetchBalanceAndAllowance();
      fetchUserStakes();
      setTransactionId(''); // Reset transaction tracking
    }
  }, [isConfirmed]);
  // Fetch user's token balance and allowance with specific wallet address
  const fetchBalanceAndAllowanceWithAddress = async (walletAddr: string) => {
    if (!walletAddr) return;
    try {
      // Get token balance
      const balanceResult = await client.readContract({
        address: CONTRACT_ADDRESSES.STAKING_TOKEN as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [walletAddr as `0x${string}`],
      });
      setBalance(balanceResult as bigint);
      // Get current Permit2 allowance
      const permit2AllowanceResult = await client.readContract({
        address: CONTRACT_ADDRESSES.STAKING_TOKEN as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [walletAddr as `0x${string}`, CONTRACT_ADDRESSES.PERMIT2 as `0x${string}`],
      });
      setPermit2Allowance(permit2AllowanceResult as bigint);
    } catch (err) {
      console.error('Error fetching balance/allowance:', err);
      setError('Failed to fetch wallet data');
    }
  };

  // Fetch user's token balance and allowance (using state wallet address)
  const fetchBalanceAndAllowance = async () => {
    await fetchBalanceAndAllowanceWithAddress(walletAddress);
  };
  const handleStakeWithPermit2 = async () => {
    if (!amount || !walletAddress) {
      setError('Wallet not connected or amount not specified');
      return;
    }

    try {
      setError(null);
      setIsStaking(true);

      const amountToStake = parseEther(amount);

      // Validate amount
      if (amountToStake <= 0) {
        throw new Error('Amount must be greater than 0');
      }
      // Check if user has enough balance
      if (amountToStake > balance) {
        throw new Error(`Insufficient balance. You have ${formatBigInt(balance)} WLD, but trying to stake ${amount} WLD`);
      }
      console.log('Starting Permit2 staking process...');
      console.log('Amount to stake:', amount, 'Wei:', amountToStake.toString());
      // Get nonce for permit2
      const wordPos = 0;
      const bitmap = await client.readContract({
        address: CONTRACT_ADDRESSES.WORLD_STAKING as `0x${string}`,
        abi: WORLD_STAKING_ABI,
        functionName: 'getNonceBitmap',
        args: [walletAddress as `0x${string}`, BigInt(wordPos)],
      });
      let bitmapBigInt = BigInt(bitmap as string);
      let bit = 0;
      while (bit < 256) {
        if ((bitmapBigInt & (BigInt(1) << BigInt(bit))) === BigInt(0)) break;
        bit++;
      }
      if (bit === 256) throw new Error('No available nonce found');
      const nonce = BigInt(wordPos * 256 + bit);
      // Create permit transfer data with 30-minute deadline
      const deadline = Math.floor((Date.now() + 30 * 60 * 1000) / 1000).toString();

      const permitTransfer = {
        permitted: {
          token: CONTRACT_ADDRESSES.STAKING_TOKEN,
          amount: amountToStake.toString(),
        },
        nonce: nonce.toString(),
        deadline,
      };
      const transferDetails = {
        to: CONTRACT_ADDRESSES.WORLD_STAKING,
        requestedAmount: amountToStake.toString(),
      };
      console.log('Permit transfer data:', permitTransfer);
      console.log('Transfer details:', transferDetails);
      // Send transaction using World Mini App with Permit2
      const { commandPayload, finalPayload } = await MiniKit.commandsAsync.sendTransaction({
        transaction: [
          {
            address: CONTRACT_ADDRESSES.WORLD_STAKING,
            abi: WORLD_STAKING_ABI,
            functionName: 'stakeWithPermit2',
            args: [
              amountToStake.toString(),
              [
                [
                  permitTransfer.permitted.token,
                  permitTransfer.permitted.amount,
                ],
                permitTransfer.nonce,
                permitTransfer.deadline,
              ],
              'PERMIT2_SIGNATURE_PLACEHOLDER_0',
            ],
          },
        ],
        permit2: [
          {
            ...permitTransfer,
            spender: CONTRACT_ADDRESSES.WORLD_STAKING,
          },
        ],
      });
      if (finalPayload.status === 'error') {
        console.error('Error sending staking transaction:', finalPayload);
        setError('Failed to send staking transaction');
      } else {
        console.log('Staking transaction sent:', finalPayload.transaction_id);
        setTransactionId(finalPayload.transaction_id);

                  // Store staking information in database
          try {
            const response = await fetch('/api/stake', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                stakeAmount: amount,
                walletAddress: walletAddress,
                username: session?.user?.username || session?.user?.id, // Use username or id as fallback
                transactionId: finalPayload.transaction_id,
              }),
            });

          const result = await response.json();
          if (response.ok) {
            console.log('Staking record created successfully:', result);
          } else {
            console.error('Failed to create staking record:', result.error);
          }
        } catch (dbError) {
          console.error('Error storing staking record:', dbError);
          // Don't show error to user as the transaction was successful
        }

        setAmount(''); // Clear form after successful transaction
      }

    } catch (err: any) {
      console.error('Error staking tokens:', err);
      if (err.message?.includes('user_rejected') || err.message?.includes('cancelled')) {
        setError('Transaction was cancelled by user');
      } else {
        setError(`Failed to stake tokens: ${err.message}`);
      }
    } finally {
      setIsStaking(false);
    }
  };
  const handleMaxAmount = () => {
    if (balance > BigInt(0)) {
      setAmount(formatBigInt(balance));
    }
  };
  // Helper function to parse ether
  const parseEther = (value: string): bigint => {
    try {
      const num = parseFloat(value);
      if (isNaN(num)) return BigInt(0);
      return BigInt(Math.floor(num * 1e18));
    } catch {
      return BigInt(0);
    }
  };
  // Validation
  const isValidAmount = amount && parseFloat(amount) > 0;
  const hasEnoughBalance = isValidAmount && parseEther(amount) <= balance;

  // Check if user needs to approve tokens for Permit2
  const needsApproval = isValidAmount && permit2Allowance === BigInt(0);
  // Format balance for display
  const formattedBalance = formatBigInt(balance);
  // Show transaction confirmation status
  const showTransactionStatus = transactionId && (isConfirming || isConfirmed);

  // Add function to fetch user's stakes with specific wallet address
  const fetchUserStakesWithAddress = async (walletAddr: string) => {
    if (!walletAddr) return;

    try {
      setIsLoadingStakes(true);

      // Get total number of stakes for the user
      const stakeCount = await client.readContract({
        address: CONTRACT_ADDRESSES.WORLD_STAKING as `0x${string}`,
        abi: WORLD_STAKING_ABI,
        functionName: 'getStakeCount',
        args: [walletAddr as `0x${string}`],
      });

      const totalStakes = Number(stakeCount);
      const userStakes: StakeDetails[] = [];

              // Fetch details for each stake
        for (let i = 0; i < totalStakes; i++) {
          const stakeDetails = await client.readContract({
            address: CONTRACT_ADDRESSES.WORLD_STAKING as `0x${string}`,
            abi: WORLD_STAKING_ABI,
            functionName: 'getStakeDetails',
            args: [walletAddr as `0x${string}`, BigInt(i)],
          });

        const [amount, timestamp, tradingAmount, currentTradeValue, tradeActive, claimableRewards, active] = stakeDetails as [bigint, bigint, bigint, bigint, boolean, bigint, boolean];

        userStakes.push({
          amount,
          timestamp,
          tradingAmount,
          currentTradeValue,
          tradeActive,
          claimableRewards,
          active,
          index: i,
        });
      }

      setStakes(userStakes);
    } catch (err) {
      console.error('Error fetching user stakes:', err);
      setError('Failed to fetch stakes');
    } finally {
      setIsLoadingStakes(false);
    }
  };

  // Add function to fetch user's stakes (using state wallet address)
  const fetchUserStakes = async () => {
    await fetchUserStakesWithAddress(walletAddress);
  };

  // Helper function to fetch database stakes (for logging/tracking purposes)
  const fetchDatabaseStakes = async () => {
    if (!walletAddress) return;
    
    try {
      const response = await fetch(`/api/stake?walletAddress=${walletAddress}`);
      const result = await response.json();
      
      if (response.ok) {
        console.log('Database stakes:', result);
        return result.stakes;
      } else {
        console.error('Failed to fetch database stakes:', result.error);
        return [];
      }
    } catch (error) {
      console.error('Error fetching database stakes:', error);
      return [];
    }
  };

  // Add function to check if a stake can be unstaked
  const canUnstake = async (stakeIndex: number): Promise<boolean> => {
    if (!walletAddress) return false;

    try {
      const result = await client.readContract({
        address: CONTRACT_ADDRESSES.WORLD_STAKING as `0x${string}`,
        abi: WORLD_STAKING_ABI,
        functionName: 'canUnstake',
        args: [walletAddress as `0x${string}`, BigInt(stakeIndex)],
      });

      return result as boolean;
    } catch (err) {
      console.error('Error checking unstake eligibility:', err);
      return false;
    }
  };

  // Add function to handle unstaking
  const handleUnstake = async (stakeIndex: number) => {
    if (!walletAddress) {
      setError('Wallet not connected');
      return;
    }

    try {
      setError(null);
      setIsWithdrawing(prev => ({ ...prev, [stakeIndex]: true }));

      // Check if stake can be unstaked
      const canUnstakeResult = await canUnstake(stakeIndex);
      if (!canUnstakeResult) {
        throw new Error('Cannot unstake: either lock-in period not over, trade still active, or stake not active');
      }

      // Send unstake transaction
      const { commandPayload, finalPayload } = await MiniKit.commandsAsync.sendTransaction({
        transaction: [
          {
            address: CONTRACT_ADDRESSES.WORLD_STAKING,
            abi: WORLD_STAKING_ABI,
            functionName: 'unstake',
            args: [BigInt(stakeIndex)],
          },
        ],
      });

      if (finalPayload.status === 'error') {
        console.error('Error sending unstake transaction:', finalPayload);
        setError('Failed to send unstake transaction');
      } else {
        console.log('Unstake transaction sent:', finalPayload.transaction_id);
        setTransactionId(finalPayload.transaction_id);
      }

    } catch (err: any) {
      console.error('Error unstaking tokens:', err);
      if (err.message?.includes('user_rejected') || err.message?.includes('cancelled')) {
        setError('Transaction was cancelled by user');
      } else {
        setError(`Failed to unstake tokens: ${err.message}`);
      }
    } finally {
      setIsWithdrawing(prev => ({ ...prev, [stakeIndex]: false }));
    }
  };

    // Add function to handle claiming rewards
    const handleClaimRewards = async (stakeIndex: number) => {
      if (!walletAddress) {
        setError('Wallet not connected');
        return;
      }
  
      try {
        setError(null);
        setIsClaimingRewards(prev => ({ ...prev, [stakeIndex]: true }));
  
        // Send claim rewards transaction
        const { commandPayload, finalPayload } = await MiniKit.commandsAsync.sendTransaction({
          transaction: [
            {
              address: CONTRACT_ADDRESSES.WORLD_STAKING,
              abi: WORLD_STAKING_ABI,
              functionName: 'claimRewards',
              args: [BigInt(stakeIndex)],
            },
          ],
        });
  
        if (finalPayload.status === 'error') {
          console.error('Error sending claim rewards transaction:', finalPayload);
          setError('Failed to send claim rewards transaction');
        } else {
          console.log('Claim rewards transaction sent:', finalPayload.transaction_id);
          setTransactionId(finalPayload.transaction_id);
        }
  
      } catch (err: any) {
        console.error('Error claiming rewards:', err);
        if (err.message?.includes('user_rejected') || err.message?.includes('cancelled')) {
          setError('Transaction was cancelled by user');
        } else {
          setError(`Failed to claim rewards: ${err.message}`);
        }
      } finally {
        setIsClaimingRewards(prev => ({ ...prev, [stakeIndex]: false }));
      }
    };

  // Add effect to fetch stakes when wallet address changes
  useEffect(() => {
    if (walletAddress) {
      fetchUserStakesWithAddress(walletAddress);
    }
  }, [walletAddress]);

  // Helper function to format timestamp
  const formatTimestamp = (timestamp: bigint): string => {
    const date = new Date(Number(timestamp) * 1000);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  // Helper function to calculate time until unlock (7 days lock period)
  const getTimeUntilUnlock = (timestamp: bigint): string => {
    const lockEndTime = Number(timestamp) + (7 * 24 * 60 * 60); // 7 days lock period
    const timeLeft = lockEndTime - currentTime;

    if (timeLeft <= 0) return 'Unlocked';

    const days = Math.floor(timeLeft / (24 * 60 * 60));
    const hours = Math.floor((timeLeft % (24 * 60 * 60)) / (60 * 60));
    const minutes = Math.floor((timeLeft % (60 * 60)) / 60);
    const seconds = timeLeft % 60;

    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m ${seconds}s`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  };

    // Helper function to get lock end date
    const getLockEndDate = (timestamp: bigint): string => {
      const lockEndTime = Number(timestamp) + (7 * 24 * 60 * 60); // 7 days lock period
      const date = new Date(lockEndTime * 1000);
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    };

  return (
    <div className="w-full bg-neutral-900">
      <div className="max-w-4xl mx-auto py-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
            🌍 World Staking Platform
          </h1>
          <p className="text-neutral-400 text-lg">Stake your tokens and earn rewards with automated trading</p>
        </div>

        {/* Main Card */}
        <div className="bg-neutral-800 rounded-2xl shadow-xl border border-neutral-700 overflow-hidden">
          {/* Tab Navigation */}
          <div className="border-b border-neutral-700 bg-neutral-800">
            <div className="flex">
              <button
                onClick={() => setActiveTab('stake')}
                className={`flex-1 px-6 py-4 text-center font-semibold transition-all duration-300 relative ${activeTab === 'stake'
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'text-neutral-400 hover:text-blue-400 hover:bg-neutral-700 border-r border-neutral-700'
                  }`}
              >
                <span className="flex items-center justify-center gap-2">
                  💰 Stake Tokens
                </span>
                {activeTab === 'stake' && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-400"></div>
                )}
              </button>
              <button
                onClick={() => setActiveTab('withdraw')}
                className={`flex-1 px-6 py-4 text-center font-semibold transition-all duration-300 relative ${activeTab === 'withdraw'
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'text-neutral-400 hover:text-blue-400 hover:bg-neutral-700'
                  }`}
              >
                <span className="flex items-center justify-center gap-2">
                  🏦 Withdraw Stakes
                </span>
                {activeTab === 'withdraw' && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-400"></div>
                )}
              </button>
            </div>
          </div>

          <div className="p-2">
            {/* Transaction Status */}
            {showTransactionStatus && (
              <div className="mb-6 p-4 bg-blue-900/30 border border-blue-700 rounded-xl">
                <div className="flex items-center gap-3">
                  {isConfirming && (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-400 border-t-transparent"></div>
                      <div>
                        <p className="font-medium text-blue-400">Transaction Confirming...</p>
                        <p className="text-sm text-blue-300">Please wait while we process your transaction</p>
                      </div>
                    </>
                  )}
                  {isConfirmed && (
                    <>
                      <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-xs">✓</span>
                      </div>
                      <div>
                        <p className="font-medium text-green-400">Transaction Confirmed!</p>
                        <p className="text-sm text-green-300">Your transaction was successful</p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="mb-6 p-4 bg-red-900/30 border border-red-700 rounded-xl">
                <div className="flex items-start gap-3">
                  <span className="text-red-400 text-xl">⚠️</span>
                  <div className="flex-1">
                    <p className="font-medium text-red-400">Error</p>
                    <p className="text-sm text-red-300">{error}</p>
                  </div>
                  <button
                    onClick={() => setError(null)}
                    className="text-red-400 hover:text-red-300 transition-colors p-1 hover:bg-red-900/50 rounded-full"
                  >
                    <span className="text-xl">×</span>
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'stake' && (
              <div className="space-y-6">
                <div className="text-center">
                  <h2 className="text-2xl font-bold text-white mb-2">Stake Your Tokens</h2>
                  <p className="text-neutral-400">Start earning rewards with automated trading</p>
                </div>

                {/* Balance Card */}
                <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-6 text-white shadow-lg">
                  <h3 className="text-lg font-semibold mb-2">Your Balance</h3>
                  <p className="text-3xl font-bold">{formattedBalance} WLD</p>
                </div>

                {/* Staking Form */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-neutral-300 mb-2">
                      Amount to Stake
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="Enter amount (e.g., 10.5)"
                        disabled={isConfirming}
                        className="w-full p-4 pr-16 text-lg bg-neutral-700 border-2 border-neutral-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-neutral-800 disabled:cursor-not-allowed transition-all shadow-sm text-white placeholder-neutral-500"
                      />
                      <button
                        onClick={handleMaxAmount}
                        disabled={balance === BigInt(0) || isConfirming}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 px-3 py-1 bg-blue-900/50 text-blue-400 text-sm font-semibold rounded-lg hover:bg-blue-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 border border-blue-700 hover:border-blue-600"
                      >
                        MAX
                      </button>
                    </div>
                    {isValidAmount && !hasEnoughBalance && (
                      <p className="mt-2 text-sm text-red-400">Insufficient balance</p>
                    )}
                  </div>

                  {/* Stake Button */}
                  <button
                    onClick={handleStakeWithPermit2}
                    disabled={!isValidAmount || !hasEnoughBalance || isStaking || !walletAddress || isConfirming}
                    className={`w-full py-4 px-6 rounded-xl font-semibold text-lg transition-all duration-300 border-2 ${isStaking || !isValidAmount || !hasEnoughBalance || isConfirming
                      ? 'bg-neutral-700 text-neutral-500 cursor-not-allowed border-neutral-600'
                      : 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 transform hover:scale-[1.02] shadow-lg hover:shadow-xl border-blue-600 hover:border-blue-700'
                      }`}
                  >
                    {isStaking ? (
                      <span className="flex items-center justify-center gap-2">
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                        Staking...
                      </span>
                    ) : (
                      '🚀 Stake with Permit2'
                    )}
                  </button>
                </div>

                {/* Info Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-neutral-700 border-2 border-neutral-600 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
                    <h4 className="font-semibold text-blue-400 mb-2">📊 Trading Strategy</h4>
                    <ul className="text-sm text-neutral-300 space-y-1">
                      <li>• 2% of staked amount used for trading</li>
                      <li>• Automated profit generation</li>
                      <li>• Real-time value tracking</li>
                    </ul>
                  </div>
                  <div className="bg-neutral-700 border-2 border-neutral-600 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
                    <h4 className="font-semibold text-green-400 mb-2">🎁 Rewards</h4>
                    <ul className="text-sm text-neutral-300 space-y-1">
                      <li>• Claim rewards on Sundays</li>
                      <li>• 10-minute lock period (testing)</li>
                      <li>• Profit-based reward system</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Withdraw Tab Content */}
            {activeTab === 'withdraw' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-white">Your Stakes</h2>
                    <p className="text-neutral-400">Manage and withdraw your staked tokens</p>
                  </div>
                  <button
                    onClick={fetchUserStakes}
                    disabled={isLoadingStakes}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-2 border-2 border-blue-600 hover:border-blue-700 shadow-md hover:shadow-lg"
                  >
                    {isLoadingStakes ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                        Refreshing...
                      </>
                    ) : (
                      <>
                        🔄 Refresh
                      </>
                    )}
                  </button>
                </div>

                {stakes.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-neutral-400">No stakes found. Start staking to see your positions here.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {stakes.map((stake, index) => (
                      <div key={index} className="bg-neutral-700 border-2 border-neutral-600 rounded-xl p-6 shadow-sm hover:shadow-md transition-all duration-200">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-4">
                              <h3 className="text-lg font-semibold text-white">
                                Stake #{stake.index}
                              </h3>
                              <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${stake.active
                                ? 'bg-green-900/50 text-green-400 border-green-700'
                                : 'bg-neutral-600 text-neutral-400 border-neutral-500'
                                }`}>
                                {stake.active ? '🟢 Active' : '⚫ Inactive'}
                              </span>
                              {stake.tradeActive && (
                                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-yellow-900/50 text-yellow-400 border border-yellow-700">
                                  📈 Trading
                                </span>
                              )}
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                              <div className="bg-neutral-800 rounded-lg p-3 border border-neutral-700">
                                <p className="text-xs text-blue-400 font-medium mb-1">Staked Amount</p>
                                <p className="font-mono font-semibold text-white">{formatBigInt(stake.amount)} WLD</p>
                              </div>
                              <div className="bg-neutral-800 rounded-lg p-3 border border-neutral-700">
                                <p className="text-xs text-purple-400 font-medium mb-1">Trading Amount</p>
                                <p className="font-mono font-semibold text-white">{formatBigInt(stake.tradingAmount)} WLD</p>
                              </div>
                              <div className="bg-neutral-800 rounded-lg p-3 border border-neutral-700">
                                <p className="text-xs text-green-400 font-medium mb-1">Current Value</p>
                                <p className="font-mono font-semibold text-white">{formatBigInt(stake.currentTradeValue)} WLD</p>
                              </div>
                              <div className="bg-neutral-800 rounded-lg p-3 border border-neutral-700">
                                <p className="text-xs text-yellow-400 font-medium mb-1">Rewards</p>
                                <p className="font-mono font-semibold text-white">{formatBigInt(stake.claimableRewards)} RWD</p>
                              </div>
                              <div className="bg-neutral-800 rounded-lg p-3 border border-neutral-700">
                                <p className="text-xs text-neutral-400 font-medium mb-1">Staked On</p>
                                <p className="text-xs text-neutral-300">{formatTimestamp(stake.timestamp)}</p>
                              </div>
                              
                            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                              <p className="text-xs text-orange-400 font-medium mb-2 flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                Lock-In Period
                              </p>
                              <p className="text-sm text-orange-300 font-mono">
                                {getTimeUntilUnlock(stake.timestamp) === 'Unlocked' ? (
                                  <span className="text-green-400">✅ Unlocked</span>
                                ) : (
                                  <span className="text-orange-300">{getTimeUntilUnlock(stake.timestamp)}</span>
                                )}
                              </p>
                              <p className="text-xs text-slate-200 mt-1">
                                Until: {getLockEndDate(stake.timestamp)}
                              </p>
                            </div>
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-3">
                          {stake.active && (
                            <div className="flex flex-col gap-3">
                              {/* Claim Rewards Button */}
                              <LiveFeedback
                                state={isClaimingRewards[stake.index] ? 'pending' : undefined}
                              >
                                <Button
                                  onClick={() => handleClaimRewards(stake.index)}
                                  disabled={
                                    isClaimingRewards[stake.index] ||
                                    isConfirming ||
                                    getTimeUntilUnlock(stake.timestamp) !== 'Unlocked' ||
                                    stake.claimableRewards === BigInt(0)
                                  }
                                  variant="secondary"
                                  className={`${
                                    getTimeUntilUnlock(stake.timestamp) !== 'Unlocked' || stake.claimableRewards === BigInt(0)
                                      ? 'bg-green-300/80 text-white border-slate-500/50 cursor-not-allowed'
                                      : 'bg-yellow-300/90 hover:bg-yellow-500/30 border-yellow-500/50 text-yellow-300 hover:text-yellow-200'
                                  }`}
                                >
                                  {isClaimingRewards[stake.index] ? (
                                    <div className="flex items-center gap-2">
                                      <Clock className="h-4 w-4 animate-spin" />
                                      Claiming...
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-2">
                                      <Gift className="h-4 w-4" />
                                      Claim Rewards
                                    </div>
                                  )}
                                </Button>
                              </LiveFeedback>
                              
                              {/* Withdraw Button */}
                              <LiveFeedback
                                state={isWithdrawing[stake.index] ? 'pending' : undefined}
                              >
                                <Button
                                  onClick={() => handleUnstake(stake.index)}
                                  disabled={
                                    isWithdrawing[stake.index] ||
                                    stake.tradeActive ||
                                    isConfirming ||
                                    getTimeUntilUnlock(stake.timestamp) !== 'Unlocked'
                                  }
                                  variant="secondary"
                                  className="bg-red-500/20 hover:bg-red-500/30 border-red-500/50 text-red-300 hover:text-red-200"
                                >
                                  {isWithdrawing[stake.index] ? (
                                    <div className="flex items-center gap-2">
                                      <Clock className="h-4 w-4 animate-spin" />
                                      Withdrawing...
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-2">
                                      <ArrowDown className="h-4 w-4" />
                                      Withdraw
                                    </div>
                                  )}
                                </Button>
                              </LiveFeedback>
                            </div>
                          )}

                          {stake.tradeActive && (
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/50">
                              ⚠️ Trade must be exited first
                            </span>
                          )}

                          {!stake.active && (
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-slate-400 text-white border border-slate-500/50">
                              ✅ Already withdrawn
                            </span>
                          )}
                        </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}