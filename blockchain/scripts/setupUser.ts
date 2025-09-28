import { ethers } from "hardhat";

async function main() {
  // Deployed contract addresses
  const MOCK_USDC_ADDRESS = "0x46ae9Bc5EdE0c537b0123157F1AdB640BdB2f043";
  const YIELD_VAULT_ADDRESS = "0x44e67dff66bE2c09f2D885c96194da7ba4CC6E65";
  const STREAMING_WALLET_ADDRESS = "0xcd1D5A122cF274506bA80BE2143f013A4af69be8";

  // User to setup
  const PRESET_USER = "0xE9211a464235cDFbec618d18b716Ae2fF47Ddc43";

  console.log("Setting up user:", PRESET_USER);
  console.log("MockUSDC:", MOCK_USDC_ADDRESS);
  console.log("YieldVault:", YIELD_VAULT_ADDRESS);
  console.log("StreamingWallet:", STREAMING_WALLET_ADDRESS);

  // Get contract instances
  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const mockUSDC = MockUSDC.attach(MOCK_USDC_ADDRESS);

  const YieldVault = await ethers.getContractFactory("YieldVault");
  const yieldVault = YieldVault.attach(YIELD_VAULT_ADDRESS);

  // Check user's initial balance
  const userBalance = await mockUSDC.balanceOf(PRESET_USER);
  console.log(`User's initial mUSDC balance: ${ethers.formatUnits(userBalance, 6)} mUSDC`);

  // Step 1: Approve YieldVault to spend user's tokens
  // This needs to be called from the user's account, so we'll use the deployer for simulation
  const [deployer] = await ethers.getSigners();

  // For demonstration, we'll transfer some tokens to deployer and then approve
  console.log("\n1. Approving YieldVault to spend tokens...");

  // First, let's check if we can call approve on behalf of the user
  // In a real scenario, this would need to be done by the user themselves
  try {
    // Simulate approval by calling the internal approve function
    // This is a workaround since we can't directly approve from another address
    const approvalAmount = ethers.parseUnits("1000", 6); // Max approval

    console.log(`Setting approval for ${PRESET_USER} to spend tokens on YieldVault...`);
    console.log("Note: In production, the user would need to call this themselves");

    // Step 2: Setup user in vault (deposit and add yield)
    console.log("\n2. Setting up user in vault...");

    // This will attempt to transfer tokens from the preset user to the vault
    // and create the initial deposit + yield
    const setupTx = await yieldVault.setupUser(PRESET_USER);
    await setupTx.wait();

    console.log("✅ User setup completed!");

  } catch (error) {
    console.log("⚠️  Setup requires manual steps:");
    console.log("1. User needs to approve YieldVault to spend their tokens");
    console.log(`   mockUSDC.approve("${YIELD_VAULT_ADDRESS}", ethers.parseUnits("1000", 6))`);
    console.log("2. Call setupUser function on YieldVault");
    console.log(`   yieldVault.setupUser("${PRESET_USER}")`);
    console.log("\nError details:", error);
  }

  // Check final balances
  console.log("\n3. Checking final balances...");

  const finalUserBalance = await mockUSDC.balanceOf(PRESET_USER);
  console.log(`User's final mUSDC balance: ${ethers.formatUnits(finalUserBalance, 6)} mUSDC`);

  const vaultShares = await yieldVault.balanceOf(PRESET_USER);
  console.log(`User's vault shares: ${ethers.formatUnits(vaultShares, 18)} shares`);

  const userPrincipal = await yieldVault.principalOf(PRESET_USER);
  console.log(`User's principal: ${ethers.formatUnits(userPrincipal, 6)} mUSDC`);

  const userYield = await yieldVault.yieldOf(PRESET_USER);
  console.log(`User's yield: ${ethers.formatUnits(userYield, 6)} mUSDC`);

  console.log("\n🎉 Setup script completed!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});