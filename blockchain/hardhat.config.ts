import type { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const AMOY_RPC_URL =
  "https://polygon-amoy.g.alchemy.com/v2/6PTbkOM8E4XL3DWssXpti";
const SEPOLIA_RPC_URL =
  "https://eth-sepolia.g.alchemy.com/v2/6PTbkOM8E4XL3DWssXpti";
const PRIVATE_KEY =
  "f21dd196d5175245b0d0d236edb9a9b7a3721f3f941a5ff3de706afedab199ab";

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
