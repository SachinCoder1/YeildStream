// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockUSDC
 * @author Your Name
 * @notice A simple ERC20 token to simulate USDC for testing purposes.
 * @dev It includes a public `mint` function for easily distributing tokens
 * to test accounts. The decimals are set to 6 to match USDC.
 */
contract MockUSDC is ERC20, Ownable {
    constructor() ERC20("Mock USDC", "mUSDC") Ownable(msg.sender) {}

    /**
     * @notice Mints new tokens to a specified account.
     * @dev This function is open for anyone to call in a test environment but should
     * be restricted or removed for a production version of a token.
     * @param to The address to receive the minted tokens.
     * @param amount The amount of tokens to mint (in the smallest unit, e.g., wei).
     */
    function mint(address to, uint256 amount) public {
        _mint(to, amount);
    }
    
    /**
     * @dev Overrides the ERC20 decimals function to return 6, matching USDC.
     */
    function decimals() public pure override returns (uint8) {
        return 6;
    }
}

