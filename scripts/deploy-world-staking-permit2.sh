#!/bin/bash

# Deploy WorldStaking Permit2 Contract to World Chain Sepolia
# Usage: ./scripts/deploy-world-staking-permit2.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== WorldStaking Permit2 Deployment Script ===${NC}"

# Check if required environment variables are set
if [ -z "$PRIVATE_KEY" ]; then
    echo -e "${RED}ERROR: PRIVATE_KEY environment variable is not set${NC}"
    echo "Please set your private key: export PRIVATE_KEY=your_private_key_here"
    exit 1
fi

echo -e "${YELLOW}Checking foundry installation...${NC}"
if ! command -v forge &> /dev/null; then
    echo -e "${RED}ERROR: Foundry (forge) is not installed${NC}"
    echo "Please install Foundry: https://book.getfoundry.sh/getting-started/installation"
    exit 1
fi

echo -e "${YELLOW}Building contracts...${NC}"
forge build

if [ $? -ne 0 ]; then
    echo -e "${RED}ERROR: Build failed${NC}"
    exit 1
fi

echo -e "${YELLOW}Deploying WorldStaking Permit2 to World Chain Sepolia...${NC}"
echo -e "${BLUE}This will deploy:${NC}"
echo -e "${BLUE}- StakingToken (WST)${NC}"
echo -e "${BLUE}- RewardToken (RWD)${NC}"
echo -e "${BLUE}- WorldStaking contract with Permit2 integration${NC}"

forge script script/DeployWorldStakingPermit2.s.sol:DeployWorldStakingPermit2Script \
    --rpc-url world_chain_sepolia \
    --broadcast \
    --verify \
    --slow

if [ $? -eq 0 ]; then
    echo -e "${GREEN}Deployment completed successfully!${NC}"
    echo -e "${YELLOW}Important Notes:${NC}"
    echo -e "${BLUE}1. Save the deployed contract addresses${NC}"
    echo -e "${BLUE}2. Update your frontend configuration${NC}"
    echo -e "${BLUE}3. The contract uses the universal Permit2 address: 0x000000000022D473030F116dDEE9F6B43aC78BA3${NC}"
    echo -e "${BLUE}4. Users can stake using either legacy approve+stake or Permit2 signatures${NC}"
else
    echo -e "${RED}Deployment failed! Check the error messages above.${NC}"
    exit 1
fi 