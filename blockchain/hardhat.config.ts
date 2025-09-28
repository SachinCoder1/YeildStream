import type { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const AMOY_RPC_URL =
  "https://polygon-amoy.g.alchemy.com/v2/6PTbkOM8E4XL3DWssXpti";
const SEPOLIA_RPC_URL =
  "https://eth-sepolia.g.alchemy.com/v2/6PTbkOM8E4XL3DWssXpti";
const PRIVATE_KEY =
  "bf1187a325e3c031d4af4cf7bf662d16196166aea8ceff13b60497382330f1e6";

const config: HardhatUserConfig = {
  solidity: "0.8.20",
  networks: {
    amoy: {
      url: AMOY_RPC_URL,
      accounts: [PRIVATE_KEY],
      chainId: 80002,
    },
    sepolia: {
      url: SEPOLIA_RPC_URL,
      accounts: [PRIVATE_KEY],
      chainId: 11155111,
    },
  },
};

export default config;
