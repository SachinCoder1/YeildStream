import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const MicropaymentModule = buildModule("MicropaymentModule", (m) => {
  // Get preset user address parameter (default to a test address)
  const presetUser = m.getParameter("presetUser", "0xE9211a464235cDFbec618d18b716Ae2fF47Ddc43");

  // Deploy MockUSDC first without vault address (we'll approve later)
  const mockUSDC = m.contract("MockUSDC", [presetUser, "0x0000000000000000000000000000000000000000"]);

  // Deploy YieldVault with MockUSDC as the underlying asset and preset user
  const yieldVault = m.contract("YieldVault", [mockUSDC, "0x0000000000000000000000000000000000000000"]);

  // Deploy StreamingWallet with YieldVault address
  const streamingWallet = m.contract("StreamingWallet", [yieldVault]);

  return {
    mockUSDC,
    yieldVault,
    streamingWallet,
    presetUser,
  };
});

export default MicropaymentModule;