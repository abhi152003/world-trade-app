'use client';

import { useState } from 'react';
import { useAccount, useChainId, useReadContract, useWriteContract } from 'wagmi';
import { CONTRACT_ADDRESSES, ERC20_ABI, WORLD_STAKING_ABI } from '../constants/contracts';
import { formatBigInt } from '../utils/format';
import { parseEther, parseGwei, maxUint256 } from 'viem';
import { getWalletClient, readContract } from '@wagmi/core';
import { useConfig } from 'wagmi';

export function StakingForm() {
  const [amount, setAmount] = useState('');
  const [isStaking, setIsStaking] = useState(false);
  const [isSettingAllowance, setIsSettingAllowance] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { address } = useAccount();
  const chainId = useChainId();
  const { writeContractAsync } = useWriteContract();
  const config = useConfig();

  const { data: balance } = useReadContract({
    address: CONTRACT_ADDRESSES.STAKING_TOKEN as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [address as `0x${string}`],
    query: { enabled: !!address },
  });

  // Get token allowance for Permit2
  const { data: permit2Allowance, refetch: refetchAllowance } = useReadContract({
    address: CONTRACT_ADDRESSES.STAKING_TOKEN as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [address as `0x${string}`, CONTRACT_ADDRESSES.PERMIT2 as `0x${string}`],
    query: { enabled: !!address },
  });

  const handleMaxAmount = () => {
    if (balance) setAmount(formatBigInt(balance as bigint));
  };

  const handleSetMaxAllowance = async () => {
    if (!address) return;
    
    try {
      setError(null);
      setIsSettingAllowance(true);
      
      console.log('Setting maximum allowance for Permit2...');
      
      const txHash = await writeContractAsync({
        address: CONTRACT_ADDRESSES.STAKING_TOKEN as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [CONTRACT_ADDRESSES.PERMIT2 as `0x${string}`, maxUint256],
      });
      
      console.log('Allowance set! Transaction Hash:', txHash);
      
      // Refetch allowance to update UI
      await refetchAllowance();
      
    } catch (err: any) {
      console.error('Error setting allowance:', err);
      setError(`Failed to set allowance: ${err.message}`);
    } finally {
      setIsSettingAllowance(false);
    }
  };

  const handleStakeWithPermit2 = async () => {
    if (!amount || !address) return;
    
    try {
      setError(null);
      setIsStaking(true);

      // Validate amount
      const parsedAmount = parseEther(amount);
      if (parsedAmount <= 0) {
        throw new Error('Amount must be greater than 0');
      }

      // Check if user has enough balance
      if (balance && parsedAmount > (balance as bigint)) {
        throw new Error(`Insufficient balance. You have ${formatBigInt(balance as bigint)} WST, but trying to stake ${amount} WST`);
      }

      // Additional safety check - ensure we have sufficient balance with some buffer
      if (!balance || balance === 0n) {
        throw new Error('No token balance detected. Please check your wallet has WST tokens.');
      }

      console.log('Starting Permit2 staking process...');
      console.log('Amount to stake:', amount, 'Wei:', parsedAmount.toString());

      const wordPos = 0;
      const bitmap = await readContract(config, {
        address: CONTRACT_ADDRESSES.WORLD_STAKING as `0x${string}`,
        abi: WORLD_STAKING_ABI,
        functionName: 'getNonceBitmap',
        args: [address, BigInt(wordPos)],
      });
      console.log('Bitmap:', bitmap);

      let bitmapBigInt = BigInt(bitmap as string);
      let bit = 0;
      while (bit < 256) {
        if ((bitmapBigInt & (1n << BigInt(bit))) === 0n) break;
        bit++;
      }
      if (bit === 256) throw new Error('No available nonce found');
      const nonce = BigInt(wordPos * 256 + bit);
      console.log('Nonce:', nonce.toString());

      const deadline = BigInt(Math.floor(Date.now() / 1000) + 1 * 60);
      console.log('Deadline:', deadline.toString());

      const permitData = {
        permitted: {
          token: CONTRACT_ADDRESSES.STAKING_TOKEN,
          amount: parseEther(amount),
        },
        spender: CONTRACT_ADDRESSES.WORLD_STAKING,
        nonce,
        deadline,
      };
      console.log('PermitData:', permitData);
      
      // Log detailed comparison with debug version
      console.log('=== PERMIT DATA DETAILS ===');
      console.log('Token:', CONTRACT_ADDRESSES.STAKING_TOKEN);
      console.log('Amount:', parseEther(amount).toString());
      console.log('Nonce:', nonce.toString());
      console.log('Deadline:', deadline.toString());
      console.log('Domain chainId:', chainId);
      console.log('Domain verifyingContract:', CONTRACT_ADDRESSES.PERMIT2);

      // const domain = {
      //   name: "Permit2",
      //   chainId,
      //   verifyingContract: CONTRACT_ADDRESSES.PERMIT2,
      // };
      // console.log('Domain:', domain);

      const types = {
        PermitTransferFrom: [
          { name: "permitted", type: "TokenPermissions" },
          { name: "spender", type: "address" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ],
        TokenPermissions: [
          { name: "token", type: "address" },
          { name: "amount", type: "uint256" },
        ],
      };

      const walletClient = await getWalletClient(config);
      
      // Ensure consistent address casing to avoid signature issues
      const permit2Address = CONTRACT_ADDRESSES.PERMIT2.toLowerCase() as `0x${string}`;
      console.log('Using Permit2 address (normalized):', permit2Address);
      
      const signature = await walletClient.signTypedData({
        account: address,
        domain: {
          name: "Permit2",
          chainId,
          verifyingContract: permit2Address,
        },
        types,
        primaryType: 'PermitTransferFrom',
        message: permitData,
      });
      console.log('Signature:', signature);

      // Log exact signing parameters for comparison with debug
      console.log('=== SIGNATURE VERIFICATION DEBUG ===');
      console.log('Signer address:', address);
      console.log('Domain:', {
        name: "Permit2",
        chainId,
        verifyingContract: CONTRACT_ADDRESSES.PERMIT2,
      });
      console.log('Types:', types);
      console.log('Message (exact):', JSON.stringify(permitData, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value
      ));
      
      // Check if this matches the debug signature parameters exactly
      const debugPermitData = {
        permitted: {
          token: CONTRACT_ADDRESSES.STAKING_TOKEN,
          amount: parseEther("1"), // Debug used "1", staking uses user input
        },
        nonce: 0n,
        deadline: BigInt(Math.floor(Date.now() / 1000) + 1 * 60),
      };
      console.log('Would debug data match?', JSON.stringify(debugPermitData, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value
      ));

      // Remove manual gas settings to let wagmi estimate automatically
      console.log('=== CONTRACT CALL DETAILS ===');
      console.log('Contract Address:', CONTRACT_ADDRESSES.WORLD_STAKING);
      console.log('Function: stakeWithPermit2');
      console.log('Args:');
      console.log('  - amount:', parseEther(amount).toString());
      console.log('  - permitData:', permitData);
      console.log('  - signature:', signature);
      console.log('  - signature length:', signature.length);

      const txHash = await writeContractAsync({
        address: CONTRACT_ADDRESSES.WORLD_STAKING as `0x${string}`,
        abi: WORLD_STAKING_ABI,
        functionName: 'stakeWithPermit2',
        args: [parseEther(amount), permitData, signature],
      });
      console.log('Transaction Hash:', txHash);
      console.log('✓ Transaction submitted successfully! Check explorer for details.');

      setAmount('');
    } catch (err: any) {
      console.error('=== ERROR DETAILS ===');
      console.error('Full error object:', err);
      console.error('Error message:', err.message);
      console.error('Error data:', err.data);
      console.error('Error code:', err.code);
      
      // More detailed error handling
      let errorMessage = 'Unknown error';
      
      if (err.message) {
        if (err.message.includes('User rejected')) {
          errorMessage = 'Transaction was rejected by user';
        } else if (err.message.includes('insufficient funds')) {
          errorMessage = 'Insufficient funds for transaction';
        } else if (err.message.includes('execution reverted')) {
          // Try to extract revert reason
          const revertMatch = err.message.match(/execution reverted: (.+)/);
          const revertReason = revertMatch ? revertMatch[1] : 'unknown reason';
          errorMessage = `Contract execution failed: ${revertReason}. This might be due to: invalid signature, expired deadline, insufficient token balance, or nonce already used.`;
        } else if (err.message.includes('nonce')) {
          errorMessage = 'Nonce error - the permit might have already been used, try refreshing the page';
        } else {
          errorMessage = err.message;
        }
      }
      
      setError(`Failed to stake: ${errorMessage}`);
    } finally {
      setIsStaking(false);
    }
  };

  const formattedBalance = balance ? formatBigInt(balance as bigint) : '0';

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
        {permit2Allowance !== undefined && (
          <p className="mt-1 text-xs text-gray-500">
            Permit2 Allowance: {formatBigInt(permit2Allowance as bigint)} WST
            {(permit2Allowance as bigint) === 0n && (
              <span className="text-amber-400 ml-2">
                ⚠️ Consider setting max allowance to avoid repeated approvals
              </span>
            )}
          </p>
        )}
      </div>
      {error && (
        <div className="mb-4 p-2 bg-red-900/50 border border-red-700 rounded text-sm">
          {error}
        </div>
      )}
              <div className="flex flex-col gap-2">
          {permit2Allowance !== undefined && (permit2Allowance as bigint) === 0n && (
            <button
              onClick={handleSetMaxAllowance}
              disabled={isSettingAllowance || !address}
              className={`w-full p-2 rounded font-medium ${
                isSettingAllowance ? 'bg-gray-800 cursor-not-allowed' : 'bg-gray-600 hover:bg-gray-700'
              }`}
            >
              {isSettingAllowance ? 'Setting Allowance...' : 'Set Max Allowance (One Time)'}
            </button>
          )}
          <button
            onClick={handleStakeWithPermit2}
            disabled={!amount || isStaking || !address}
            className={`w-full p-2 rounded font-medium ${
              isStaking ? 'bg-blue-800 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {isStaking ? 'Staking...' : 'Stake with Permit2'}
          </button>
        </div>
      <div className="mt-4 text-sm text-gray-400">
        <p>• Staking locks your tokens for 10 minutes (for testing)</p>
        <p>• 2% of staked amount will be used for trading</p>
        <p>• Rewards can be claimed on Sundays after lock period</p>
      </div>
    </div>
  );
}