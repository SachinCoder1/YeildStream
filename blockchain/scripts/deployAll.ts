import { ethers } from "hardhat";

async function main() {
  console.log("🚀 Starting deployment of all contracts...");

  // 1. Deploy MockUSDC
  console.log("Deploying MockUSDC...");
  const mockUSDC = await ethers.deployContract("MockUSDC");
  await mockUSDC.waitForDeployment();
  const mockUSDCAddress = await mockUSDC.getAddress();
  console.log(`✅ MockUSDC deployed to: ${mockUSDCAddress}`);

  // 2. Deploy YieldVault
  console.log("\nDeploying YieldVault...");
  const yieldVault = await ethers.deployContract("YieldVault", [mockUSDCAddress]);
  await yieldVault.waitForDeployment();
  const yieldVaultAddress = await yieldVault.getAddress();
  console.log(`✅ YieldVault deployed to: ${yieldVaultAddress}`);

  // 3. Deploy StreamingWallet
  console.log("\nDeploying StreamingWallet...");
  const streamingWallet = await ethers.deployContract("StreamingWallet", [yieldVaultAddress]);
  await streamingWallet.waitForDeployment();
  const streamingWalletAddress = await streamingWallet.getAddress();
  console.log(`✅ StreamingWallet deployed to: ${streamingWalletAddress}`);

  console.log("\n🎉 All contracts deployed successfully!");
  console.log("==========================================");
  console.log(`MockUSDC Address: ${mockUSDCAddress}`);
  console.log(`YieldVault Address: ${yieldVaultAddress}`);
  console.log(`StreamingWallet Address: ${streamingWalletAddress}`);
  console.log("==========================================");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});