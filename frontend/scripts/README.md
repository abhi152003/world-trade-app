# Trade Simulation Scripts

This directory contains scripts for simulating trading activity for the World Trade App.

## Trade Simulation

The `simulateTrades.ts` script simulates trading activity for all active stakes in the WorldStaking contract. It:

1. Periodically updates trade values with random price movements
2. Automatically exits trades after a set period (5 minutes by default)
3. Simulates both profitable and unprofitable trades

### Setup

1. Create a `.env` file in the root of the frontend directory with your private key:

```
# Your private key for the contract owner account (without 0x prefix)
PRIVATE_KEY=your_private_key_here
```

⚠️ **IMPORTANT**: This must be the private key of the contract owner account, as only the owner can call `updateTradeValue` and `exitTrade` functions.

### WalletConnect Project ID

For the admin interface and wallet connection to work properly, you should:

1. Get a WalletConnect Project ID from https://cloud.walletconnect.com
2. Update the `WALLET_CONNECT_PROJECT_ID` constant in `app/providers.tsx`

A default project ID is provided for development, but it has request limits.

### Running the Simulation

Install the required dependencies:

```bash
npm install
```

Run the simulation:

```bash
npm run simulate-trades
```

The script will run continuously, updating trade values every 30 seconds and exiting trades after 5 minutes. You can stop the simulation at any time by pressing `Ctrl+C`.

### Configuration

You can modify the following parameters in `app/utils/tradeSimulator.ts`:

- `TRADE_UPDATE_INTERVAL`: How often trade values are updated (default: 30 seconds)
- `TRADE_EXIT_TIME`: How long a trade runs before being exited (default: 5 minutes)
- `PRICE_VOLATILITY`: The maximum percentage change in price for each update (default: 5%) 