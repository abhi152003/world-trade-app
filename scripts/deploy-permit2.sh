#!/bin/bash

# Deploy Permit2 Contract to World Chain Sepolia
# Usage: ./scripts/deploy-permit2.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Permit2 Deployment Script ===${NC}"

# Check if required environment variables are set
if [ -z "$PRIVATE_KEY" ]; then
    echo -e "${RED}ERROR: PRIVATE_KEY environment variable is not set${NC}"
    echo "Please set your private key: export PRIVATE_KEY=your_private_key_here"
    exit 1
fi

# Note: Using public RPC endpoint, no API key required for World Chain Sepolia

echo -e "${YELLOW}Checking foundry installation...${NC}"
if ! command -v forge &> /dev/null; then
    echo -e "${RED}ERROR: Foundry (forge) is not installed${NC}"
    echo "Please install Foundry: https://book.getfoundry.sh/getting-started/installation"
    exit 1
fi

echo -e "${YELLOW}Building contracts...${NC}"
forge build

echo -e "${YELLOW}Deploying Permit2 to World Chain Sepolia...${NC}"
forge script script/DeployPermit2.s.sol:DeployPermit2Script \
    --rpc-url world_chain_sepolia \
    --broadcast \
    --verify \
    --slow

echo -e "${GREEN}Deployment completed!${NC}"
echo -e "${YELLOW}Note: Save the deployed contract address for future use${NC}" 