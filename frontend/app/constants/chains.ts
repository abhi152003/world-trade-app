import { Chain } from 'viem';

export const worldChainSepolia: Chain = {
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