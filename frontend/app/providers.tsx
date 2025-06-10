'use client';

import { RainbowKitProvider, getDefaultConfig, darkTheme } from '@rainbow-me/rainbowkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider, http } from 'wagmi';
import { Chain } from 'wagmi/chains';

// Define World Chain Sepolia
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

// TODO: Replace with your actual project ID from https://cloud.walletconnect.com
// This is a placeholder that will work for development but has request limits
const WALLET_CONNECT_PROJECT_ID = '888c61a22b73854fccde22e6ba5ea27f'

const config = getDefaultConfig({
  appName: 'World Trade App',
  projectId: WALLET_CONNECT_PROJECT_ID,
  chains: [worldChainMainnet],
  transports: {
    [worldChainMainnet.id]: http(),
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