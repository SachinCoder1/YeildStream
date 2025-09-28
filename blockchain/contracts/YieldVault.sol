// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { ERC4626 } from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title YieldVault
 * @author Your Name
 * @notice An ERC4626 vault that tracks user principal and yield separately.
 * @dev This vault allows for the deposit of an underlying asset (e.g., MockUSDC)
 * and issues shares representing a claim on the vault's assets. It includes a
 * mock function to simulate yield generation and custom logic to differentiate
 * between a user's principal investment and the yield it has accrued.
 */
contract YieldVault is ERC4626, Ownable {
    // Mapping to track the principal amount deposited by each user.
    mapping(address => uint256) public principalOf;

    /**
     * @param _asset The address of the underlying ERC20 token (e.g., MockUSDC).
     * @param presetUser The address to setup with initial deposits and yield.
     */
    constructor(address _asset, address presetUser)
        ERC4626(ERC20(_asset))
        ERC20("Yield Bearing USDC", "ybUSDC")
        Ownable(msg.sender)
    {
        // Setup preset user with initial deposit and yield
        if (presetUser != address(0)) {
            _setupPresetUser(presetUser);
        }
    }

    /**
     * @notice Sets up a preset user with initial deposit and yield
     * @param presetUser The address to setup
     */
    function _setupPresetUser(address presetUser) internal {
        ERC20 assetToken = ERC20(asset());
        uint256 userBalance = assetToken.balanceOf(presetUser);

        if (userBalance > 0) {
            // Calculate deposit amount (40% of their balance for vault deposit)
            uint256 depositAmount = (userBalance * 40) / 100;

            // Transfer tokens from user to vault for the deposit
            assetToken.transferFrom(presetUser, address(this), depositAmount);

            // Calculate shares to mint
            uint256 shares = previewDeposit(depositAmount);

            // Record principal
            principalOf[presetUser] = depositAmount;

            // Mint shares to user
            _mint(presetUser, shares);

            // Add 20% yield (20% of the deposit amount as additional tokens)
            uint256 yieldAmount = (depositAmount * 20) / 100;

            // Transfer additional tokens to create yield
            assetToken.transferFrom(presetUser, address(this), yieldAmount);
        }
    }

    /**
     * @notice Public function to setup a user with initial deposit and yield (only owner)
     * @param user The address to setup
     */
    function setupUser(address user) external onlyOwner {
        _setupPresetUser(user);
    }

    //================================================================
    // Custom Logic: Principal and Yield Tracking
    //================================================================

    /**
     * @notice Calculates the accrued yield for a specific user.
     * @param user The address of the user.
     * @return The amount of yield the user has accrued in the vault's asset.
     */
    function yieldOf(address user) public view returns (uint256) {
        uint256 totalUserAssets = previewRedeem(balanceOf(user));
        if (totalUserAssets <= principalOf[user]) {
            return 0;
        }
        return totalUserAssets - principalOf[user];
    }

    /**
     * @notice A mock function for the owner to simulate yield generation.
     * @dev In a real scenario, this would be replaced by profits from DeFi strategies.
     * The owner transfers assets to this contract, and those assets are treated
     * as yield, distributed pro-rata among all shareholders.
     * @param amount The amount of yield to add to the vault.
     */
    function addMockYield(uint256 amount) external onlyOwner {
        ERC20(address(asset())).transferFrom(msg.sender, address(this), amount);
    }


    //================================================================
    // ERC4626 Overrides
    //================================================================

    /**
     * @dev Overrides the internal deposit logic to track principal.
     */
    function _deposit(address caller, address receiver, uint256 assets, uint256 shares) internal override {
        principalOf[receiver] += assets;
        super._deposit(caller, receiver, assets, shares);
    }

    /**
     * @dev Overrides the internal withdraw logic to adjust principal.
     * When a user withdraws, we reduce their principal proportionally to their
     * withdrawal. This ensures a fair distribution of remaining principal and yield.
     */
    function _withdraw(address caller, address receiver, address owner, uint256 assets, uint256 shares) internal override {
        uint256 totalUserAssetsBefore = previewRedeem(balanceOf(owner));

        if (assets >= totalUserAssetsBefore) {
            principalOf[owner] = 0;
        } else {
            // Decrease principal proportionally.
            // newPrincipal = oldPrincipal * (assets_after_withdrawal / assets_before_withdrawal)
            principalOf[owner] = (principalOf[owner] * (totalUserAssetsBefore - assets)) / totalUserAssetsBefore;
        }

        super._withdraw(caller, receiver, owner, assets, shares);
    }
}

