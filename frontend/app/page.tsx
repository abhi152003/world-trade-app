'use client';

import { ConnectButton } from './components/ConnectButton';
import { StakingForm } from './components/StakingForm';
import { StakesList } from './components/StakesList';
import { StakingDebug } from './components/StakingDebug';
import { useAccount } from 'wagmi';
import Link from 'next/link';

export default function Home() {
  const { isConnected } = useAccount();

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="border-b border-gray-800">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">World Trade App</h1>
          <div className="flex items-center gap-4">
            <Link href="/admin" className="text-blue-400 hover:text-blue-300">
              Admin
            </Link>
            <ConnectButton />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {!isConnected ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <h2 className="text-3xl font-bold mb-4">Welcome to World Trade App</h2>
            <p className="text-gray-400 max-w-lg mb-8">
              Connect your wallet to start staking tokens and earning rewards through automated trading.
            </p>
            <div className="mt-4">
              <ConnectButton />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1">
              <StakingForm />
              <StakingDebug />
            </div>
            <div className="lg:col-span-2">
              <StakesList />
            </div>
          </div>
        )}
      </main>

      <footer className="mt-auto border-t border-gray-800 py-6">
        <div className="container mx-auto px-4 text-center text-gray-500 text-sm">
          <p>World Trade App &copy; 2025 All rights reserved.</p>
          <p className="mt-2">
            Deployed on World Chain Sepolia Testnet
          </p>
        </div>
      </footer>
    </div>
  );
}
