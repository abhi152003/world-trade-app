'use client';

import { useState } from 'react';
import { useAccount, useChainId } from 'wagmi';
import { CONTRACT_ADDRESSES } from '../constants/contracts';
import { parseEther } from 'viem';
import { getWalletClient, readContract } from '@wagmi/core';
import { useConfig } from 'wagmi';

export function Permit2Debug() {
  const { address } = useAccount();
  const chainId = useChainId();
  const config = useConfig();
  const [testAmount, setTestAmount] = useState('1');
  const [result, setResult] = useState<string>('');

  const testSignature = async () => {
    if (!address) return;
    
    try {
      setResult('Testing signature generation...');
      
      // Test signature generation without contract call
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 1 * 60);
      
      const permitData = {
        permitted: {
          token: CONTRACT_ADDRESSES.STAKING_TOKEN,
          amount: parseEther(testAmount),
        },
        nonce: 0n,
        deadline,
      };

      const types = {
        PermitTransferFrom: [
          { name: "permitted", type: "TokenPermissions" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ],
        TokenPermissions: [
          { name: "token", type: "address" },
          { name: "amount", type: "uint256" },
        ],
      };

      const walletClient = await getWalletClient(config);
      const signature = await walletClient.signTypedData({
        account: address,
        domain: {
          name: "Permit2",
          version: "1",
          chainId,
          verifyingContract: CONTRACT_ADDRESSES.PERMIT2 as `0x${string}`,
        },
        types,
        primaryType: 'PermitTransferFrom',
        message: permitData,
      });

      setResult(`✓ Signature generated successfully!
Length: ${signature.length}
First 20 chars: ${signature.substring(0, 20)}...

Domain:
- Name: Permit2
- Version: 1
- ChainId: ${chainId}
- Contract: ${CONTRACT_ADDRESSES.PERMIT2}

Message:
- Token: ${permitData.permitted.token}
- Amount: ${permitData.permitted.amount.toString()}
- Nonce: ${permitData.nonce.toString()}
- Deadline: ${permitData.deadline.toString()}`);

    } catch (err: any) {
      setResult(`❌ Error: ${err.message}`);
    }
  };

  const checkContractAddresses = async () => {
    if (!address) return;
    
    try {
      setResult('Checking contract addresses...');
      
      // Get the Permit2 address from WorldStaking contract
      const contractPermit2Address = await readContract(config, {
        address: CONTRACT_ADDRESSES.WORLD_STAKING as `0x${string}`,
        abi: [
          {
            "inputs": [],
            "name": "getPermit2Address",
            "outputs": [
              {
                "internalType": "address",
                "name": "",
                "type": "address"
              }
            ],
            "stateMutability": "view",
            "type": "function"
          }
        ],
        functionName: 'getPermit2Address',
        args: [],
      });

      const addressMatch = contractPermit2Address.toString().toLowerCase() === CONTRACT_ADDRESSES.PERMIT2.toLowerCase();
      
      setResult(`Contract Address Check:
World Staking: ${CONTRACT_ADDRESSES.WORLD_STAKING}
Our Permit2: ${CONTRACT_ADDRESSES.PERMIT2}
Contract Permit2: ${contractPermit2Address}
Match: ${addressMatch ? '✓ YES' : '❌ NO'}

${!addressMatch ? `⚠️ Address mismatch! Update CONTRACT_ADDRESSES.PERMIT2 to: ${contractPermit2Address}` : ''}`);

    } catch (err: any) {
      setResult(`❌ Error checking addresses: ${err.message}`);
    }
  };

  if (!address) {
    return (
      <div className="bg-gray-800 rounded-lg p-4 mt-4">
        <h3 className="font-medium mb-2">Permit2 Debug Tools</h3>
        <p className="text-gray-400">Connect wallet to use debug tools</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-4 mt-4">
      <h3 className="font-medium mb-4">Permit2 Debug Tools</h3>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm mb-1">Test Amount:</label>
          <input
            type="text"
            value={testAmount}
            onChange={(e) => setTestAmount(e.target.value)}
            className="w-full p-2 rounded bg-gray-700 border border-gray-600 text-sm"
            placeholder="1"
          />
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={testSignature}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm"
          >
            Test Signature
          </button>
          
          <button
            onClick={checkContractAddresses}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded text-sm"
          >
            Check Addresses
          </button>
        </div>
        
        {result && (
          <div className="mt-4 p-3 bg-gray-900 rounded text-xs font-mono whitespace-pre-wrap">
            {result}
          </div>
        )}
      </div>
    </div>
  );
} 