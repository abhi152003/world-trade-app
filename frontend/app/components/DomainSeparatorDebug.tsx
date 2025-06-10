'use client';

import { useState } from 'react';
import { useAccount, useChainId } from 'wagmi';
import { CONTRACT_ADDRESSES } from '../constants/contracts';
import { readContract } from '@wagmi/core';
import { useConfig } from 'wagmi';
import { keccak256, encodePacked, encodeAbiParameters } from 'viem';

export function DomainSeparatorDebug() {
  const { address } = useAccount();
  const chainId = useChainId();
  const config = useConfig();
  const [result, setResult] = useState<string>('');

  const checkDomainSeparator = async () => {
    if (!address) return;
    
    try {
      setResult('Checking domain separator...');
      
      // Get the domain separator from the Permit2 contract
      const contractDomainSeparator = await readContract(config, {
        address: CONTRACT_ADDRESSES.PERMIT2 as `0x${string}`,
        abi: [
          {
            "inputs": [],
            "name": "DOMAIN_SEPARATOR",
            "outputs": [
              {
                "internalType": "bytes32",
                "name": "",
                "type": "bytes32"
              }
            ],
            "stateMutability": "view",
            "type": "function"
          }
        ],
        functionName: 'DOMAIN_SEPARATOR',
        args: [],
      });

      // Calculate what we expect the domain separator to be
      // Based on your contract's EIP712.sol: EIP712Domain(string name,uint256 chainId,address verifyingContract)
      // Contract uses abi.encode (not encodePacked) for domain separator calculation
      const typeHash = keccak256(encodePacked(['string'], ['EIP712Domain(string name,uint256 chainId,address verifyingContract)']));
      const nameHash = keccak256(encodePacked(['string'], ['Permit2']));
      
      // Use ABI encoding to match the contract's _buildDomainSeparator function
      // keccak256(abi.encode(typeHash, nameHash, block.chainid, address(this)))
      const expectedDomainSeparator = keccak256(
        encodeAbiParameters(
          [
            { type: 'bytes32' },
            { type: 'bytes32' },
            { type: 'uint256' },
            { type: 'address' }
          ],
          [
            typeHash,
            nameHash,
            BigInt(chainId),
            CONTRACT_ADDRESSES.PERMIT2 as `0x${string}`
          ]
        )
      );

      const match = contractDomainSeparator === expectedDomainSeparator;
      
      setResult(`Domain Separator Check:
Contract: ${contractDomainSeparator}
Expected: ${expectedDomainSeparator}
Match: ${match ? '✓ YES' : '❌ NO'}

Chain ID: ${chainId}
Permit2 Address: ${CONTRACT_ADDRESSES.PERMIT2}

${!match ? '⚠️ Domain separator mismatch! This explains the InvalidSigner error.' : '✓ Domain separator is correct.'}`);

    } catch (err: any) {
      setResult(`❌ Error checking domain separator: ${err.message}`);
    }
  };

  const testWithCanonicalAddress = async () => {
    if (!address) return;
    
    try {
      setResult('Testing with canonical Permit2 address...');
      
      const canonicalAddress = '0x000000000022D473030F116dDEE9F6B43aC78BA3';
      
      // Try to get domain separator from canonical address
      const contractDomainSeparator = await readContract(config, {
        address: canonicalAddress as `0x${string}`,
        abi: [
          {
            "inputs": [],
            "name": "DOMAIN_SEPARATOR",
            "outputs": [
              {
                "internalType": "bytes32",
                "name": "",
                "type": "bytes32"
              }
            ],
            "stateMutability": "view",
            "type": "function"
          }
        ],
        functionName: 'DOMAIN_SEPARATOR',
        args: [],
      });

      setResult(`Canonical Permit2 (${canonicalAddress}):
Domain Separator: ${contractDomainSeparator}

If this works, update CONTRACT_ADDRESSES.PERMIT2 to: ${canonicalAddress}`);

    } catch (err: any) {
      setResult(`❌ Canonical Permit2 not deployed: ${err.message}`);
    }
  };

  const tryDifferentDomainParams = async () => {
    if (!address) return;
    
    try {
      setResult('Testing different domain parameter combinations for canonical Permit2...');
      
      // Get the actual domain separator from the current Permit2 contract
      const contractDomainSeparator = await readContract(config, {
        address: CONTRACT_ADDRESSES.PERMIT2 as `0x${string}`,
        abi: [
          {
            "inputs": [],
            "name": "DOMAIN_SEPARATOR",
            "outputs": [
              {
                "internalType": "bytes32",
                "name": "",
                "type": "bytes32"
              }
            ],
            "stateMutability": "view",
            "type": "function"
          }
        ],
        functionName: 'DOMAIN_SEPARATOR',
        args: [],
      });
      
      // Test different parameter combinations that might be used on testnets
      const variations = [
        { name: 'Permit2', version: '1' },
        { name: 'Permit2', version: '1.0.0' },
        { name: 'permit2', version: '1' },
        { name: 'Permit2', version: '2' },
        { name: 'SignatureTransfer', version: '1' },
        { name: 'Permit2', version: '' },
        { name: 'Uniswap', version: '1' },
        { name: 'Permit2', version: '1.0' },
      ];
      
      let matchFound = false;
      let results = [];
      
      for (const variation of variations) {
        const testDomainSeparator = keccak256(
          encodePacked(
            ['bytes32', 'bytes32', 'bytes32', 'uint256', 'address'],
            [
              keccak256(encodePacked(['string'], ['EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)'])),
              keccak256(encodePacked(['string'], [variation.name])),
              keccak256(encodePacked(['string'], [variation.version])),
              BigInt(chainId),
              CONTRACT_ADDRESSES.PERMIT2 as `0x${string}`
            ]
          )
        );
        
        const isMatch = testDomainSeparator === contractDomainSeparator;
        results.push(`${isMatch ? '✅' : '❌'} "${variation.name}" v"${variation.version}"`);
        
        if (isMatch) {
          setResult(`🎉 PERFECT MATCH FOUND!

The canonical Permit2 contract uses:
Name: "${variation.name}"
Version: "${variation.version}"
Chain ID: ${chainId}
Address: ${CONTRACT_ADDRESSES.PERMIT2}

This will fix your InvalidSigner error!
I'll update the StakingForm to use these parameters.`);
          matchFound = true;
          
          // Store the correct parameters for the fix
          (window as any).correctDomainParams = variation;
          break;
        }
      }
      
      if (!matchFound) {
        setResult(`❌ No match found with standard variations.
Contract domain separator: ${contractDomainSeparator}

Tested variations:
${results.join('\n')}

This canonical Permit2 might use non-standard parameters.`);
      }

    } catch (err: any) {
      setResult(`❌ Error testing variations: ${err.message}`);
    }
  };

  const tryDifferentChainIds = async () => {
    if (!address) return;
    
    try {
      setResult('Testing different chain IDs (common issue with testnet deployments)...');
      
      // Get the actual domain separator from the contract
      const contractDomainSeparator = await readContract(config, {
        address: CONTRACT_ADDRESSES.PERMIT2 as `0x${string}`,
        abi: [
          {
            "inputs": [],
            "name": "DOMAIN_SEPARATOR",
            "outputs": [
              {
                "internalType": "bytes32",
                "name": "",
                "type": "bytes32"
              }
            ],
            "stateMutability": "view",
            "type": "function"
          }
        ],
        functionName: 'DOMAIN_SEPARATOR',
        args: [],
      });
      
      // Test with different chain IDs - sometimes testnet contracts use mainnet chain ID
      const chainIdsToTest = [
        { id: 1, name: 'Ethereum Mainnet' },
        { id: 4801, name: 'World Chain Sepolia (current)' },
        { id: 480, name: 'World Chain' },
        { id: 11155111, name: 'Ethereum Sepolia' },
        { id: 5, name: 'Ethereum Goerli' },
        { id: 137, name: 'Polygon' },
      ];
      
      let matchFound = false;
      let results = [];
      
      for (const testChainId of chainIdsToTest) {
        const testDomainSeparator = keccak256(
          encodePacked(
            ['bytes32', 'bytes32', 'bytes32', 'uint256', 'address'],
            [
              keccak256(encodePacked(['string'], ['EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)'])),
              keccak256(encodePacked(['string'], ['Permit2'])),
              keccak256(encodePacked(['string'], ['1'])),
              BigInt(testChainId.id),
              CONTRACT_ADDRESSES.PERMIT2 as `0x${string}`
            ]
          )
        );
        
        const isMatch = testDomainSeparator === contractDomainSeparator;
        results.push(`${isMatch ? '✅' : '❌'} Chain ID ${testChainId.id} (${testChainId.name})`);
        
        if (isMatch) {
          setResult(`🎉 CHAIN ID MISMATCH FOUND!

The Permit2 contract was deployed with Chain ID: ${testChainId.id}
But we're signing with Chain ID: ${chainId}

Correct domain parameters:
- name: "Permit2"
- version: "1"  
- chainId: ${testChainId.id}
- verifyingContract: ${CONTRACT_ADDRESSES.PERMIT2}

This explains the InvalidSigner error! I'll fix the StakingForm to use the correct chain ID.`);
          matchFound = true;
          
          // Store the correct parameters
          (window as any).correctDomainParams = {
            name: 'Permit2',
            version: '1',
            chainId: testChainId.id
          };
          break;
        }
      }
      
      if (!matchFound) {
        setResult(`❌ No chain ID match found.
Contract domain separator: ${contractDomainSeparator}

Tested chain IDs:
${results.join('\n')}

The contract might use different name/version parameters or have other custom settings.`);
      }

    } catch (err: any) {
      setResult(`❌ Error testing chain IDs: ${err.message}`);
    }
  };

  if (!address) {
    return null;
  }

  return (
    <div className="bg-red-800/20 border border-red-700 rounded-lg p-4 mt-4">
      <h3 className="font-medium mb-4 text-red-300">🔍 Domain Separator Debug (InvalidSigner Fix)</h3>
      
      <div className="space-y-4">
        <p className="text-sm text-red-200">
          The InvalidSigner() error suggests a domain separator mismatch. Let's debug this:
        </p>
        
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={checkDomainSeparator}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-sm"
          >
            Check Current Domain Separator
          </button>
          
          <button
            onClick={testWithCanonicalAddress}
            className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 rounded text-sm"
          >
            Test Canonical Permit2
          </button>
          
          <button
            onClick={tryDifferentDomainParams}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded text-sm"
          >
            Find Correct Domain Params
          </button>
          
          <button
            onClick={tryDifferentChainIds}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded text-sm"
          >
            Try Different Chain IDs
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