'use client';

import { RainbowKitProvider, getDefaultConfig, darkTheme } from '@rainbow-me/rainbowkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider, http } from 'wagmi';
import { Chain } from 'wagmi/chains';

// Define World Chain Sepolia
const worldChainSepolia: Chain = {
  id: 4801,
  name: 'World Chain Sepolia',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://worldchain-sepolia.gateway.tenderly.co'] },
    public: { http: ['https://worldchain-sepolia.gateway.tenderly.co'] },
  },
  blockExplorers: {
    default: { name: 'WorldScan', url: 'https://sepolia.worldscan.io' },
  },
  testnet: true,
};

// TODO: Replace with your actual project ID from https://cloud.walletconnect.com
// This is a placeholder that will work for development but has request limits
const WALLET_CONNECT_PROJECT_ID = '888c61a22b73854fccde22e6ba5ea27f'

const config = getDefaultConfig({
  appName: 'World Trade App',
  projectId: WALLET_CONNECT_PROJECT_ID,
  chains: [worldChainSepolia],
  transports: {
    [worldChainSepolia.id]: http(),
  },
});

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={darkTheme()}>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
} 