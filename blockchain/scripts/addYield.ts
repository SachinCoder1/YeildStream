import { ethers } from "hardhat";

async function main() {
  // Deployed contract addresses
  const MOCK_USDC_ADDRESS = "0x46ae9Bc5EdE0c537b0123157F1AdB640BdB2f043";
  const YIELD_VAULT_ADDRESS = "0x44e67dff66bE2c09f2D885c96194da7ba4CC6E65";

  // User to check
  const PRESET_USER = "0xE9211a464235cDFbec618d18b716Ae2fF47Ddc43";

  console.log("Adding yield to vault...");
  console.log("MockUSDC:", MOCK_USDC_ADDRESS);
  console.log("YieldVault:", YIELD_VAULT_ADDRESS);
  console.log("User:", PRESET_USER);

  // Get contract instances
  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const mockUSDC = MockUSDC.attach(MOCK_USDC_ADDRESS);

  const YieldVault = await ethers.getContractFactory("YieldVault");
  const yieldVault = YieldVault.attach(YIELD_VAULT_ADDRESS);

  const [deployer] = await ethers.getSigners();

  // Check current state
  console.log("\n=== Current State ===");
  const userPrincipal = await yieldVault.principalOf(PRESET_USER);
  const userYield = await yieldVault.yieldOf(PRESET_USER);
  const vaultShares = await yieldVault.balanceOf(PRESET_USER);
  const userBalance = await mockUSDC.balanceOf(PRESET_USER);

  console.log(`User's mUSDC balance: ${ethers.formatUnits(userBalance, 6)} mUSDC`);
  console.log(`User's vault shares: ${ethers.formatUnits(vaultShares, 18)} shares`);
  console.log(`User's principal: ${ethers.formatUnits(userPrincipal, 6)} mUSDC`);
  console.log(`User's yield: ${ethers.formatUnits(userYield, 6)} mUSDC`);

  // Calculate 20% yield based on principal
  const yieldAmount = (userPrincipal * 20n) / 100n; // 20% of principal
  console.log(`\nAdding yield: ${ethers.formatUnits(yieldAmount, 6)} mUSDC`);

  try {
    // First, mint some tokens to the deployer to add as yield
    console.log("\n1. Minting tokens to deployer for yield...");
    const mintTx = await mockUSDC.mint(deployer.address, yieldAmount);
    await mintTx.wait();

    // Approve vault to spend deployer's tokens
    console.log("2. Approving vault to spend deployer's tokens...");
    const approveTx = await mockUSDC.approve(YIELD_VAULT_ADDRESS, yieldAmount);
    await approveTx.wait();

    // Add mock yield to the vault
    console.log("3. Adding mock yield to vault...");
    const yieldTx = await yieldVault.addMockYield(yieldAmount);
    await yieldTx.wait();

    console.log("✅ Yield added successfully!");

  } catch (error) {
    console.error("❌ Error adding yield:", error);
  }

  // Check final state
  console.log("\n=== Final State ===");
  const finalUserPrincipal = await yieldVault.principalOf(PRESET_USER);
  const finalUserYield = await yieldVault.yieldOf(PRESET_USER);
  const finalVaultShares = await yieldVault.balanceOf(PRESET_USER);
  const finalUserBalance = await mockUSDC.balanceOf(PRESET_USER);

  console.log(`User's mUSDC balance: ${ethers.formatUnits(finalUserBalance, 6)} mUSDC`);
  console.log(`User's vault shares: ${ethers.formatUnits(finalVaultShares, 18)} shares`);
  console.log(`User's principal: ${ethers.formatUnits(finalUserPrincipal, 6)} mUSDC`);
  console.log(`User's yield: ${ethers.formatUnits(finalUserYield, 6)} mUSDC`);

  console.log("\n🎉 Yield generation completed!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});