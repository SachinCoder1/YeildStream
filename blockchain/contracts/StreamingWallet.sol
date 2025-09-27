// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { YieldVault } from "./YieldVault.sol";

/**
 * @title StreamingWallet
 * @author Your Name
 * @notice A wallet that enables pay-per-second streaming for content, deducting
 * payments from a user's DeFi yield-bearing vault.
 * @dev This contract interacts with a YieldVault to manage micropayments. Users
 * start, pause, and stop content streams, and are charged based on their exact
 * consumption time. Payments are first taken from accrued yield, then from principal.
 */
contract StreamingWallet is Ownable {
    //================================================================
    // State Variables
    //================================================================

    YieldVault public immutable vault;
    IERC20 public immutable asset;

    struct Content {
        bytes32 contentId;
        string contentIdentifier; // For IPFS/Filecoin CID
        uint256 fullPrice;
        uint256 totalDuration; // In seconds
        address payable creator;
    }

    struct Session {
        bytes32 contentId;
        uint256 startTime;
        uint256 lastUpdateTime;
        uint256 accumulatedTime;
        bool isActive;
    }

    mapping(bytes32 => Content) public contents;
    mapping(address => mapping(bytes32 => Session)) public userSessions;

    //================================================================
    // Events
    //================================================================

    event ContentListed(bytes32 indexed contentId, string contentIdentifier, uint256 fullPrice, uint256 totalDuration, address creator);
    event PaymentStreamStarted(address indexed user, bytes32 indexed contentId, uint256 startTime);
    event PaymentStreamPaused(address indexed user, bytes32 indexed contentId, uint256 accumulatedTime);
    event PaymentStreamStopped(address indexed user, bytes32 indexed contentId, uint256 totalTimeConsumed, uint256 amountDeducted);
    event PaymentDeducted(address indexed user, bytes32 indexed contentId, uint256 amount, bool fromYield);

    //================================================================
    // Constructor
    //================================================================

    constructor(address _vaultAddress) Ownable(msg.sender) {
        vault = YieldVault(_vaultAddress);
        asset = IERC20(vault.asset());
    }

    //================================================================
    // Admin Functions
    //================================================================

    /**
     * @notice Lists a new piece of content available for streaming.
     * @param _contentId A unique identifier for the content.
     * @param _contentIdentifier The IPFS or Filecoin CID string.
     * @param _fullPrice The price for consuming 100% of the content.
     * @param _totalDuration The total duration of the content in seconds.
     * @param _creator The address that will receive the payments.
     */
    function listContent(bytes32 _contentId, string calldata _contentIdentifier, uint256 _fullPrice, uint256 _totalDuration, address payable _creator) external onlyOwner {
        require(_contentId != bytes32(0), "Invalid content ID");
        require(_totalDuration > 0, "Duration must be positive");
        require(_creator != address(0), "Invalid creator address");

        contents[_contentId] = Content({
            contentId: _contentId,
            contentIdentifier: _contentIdentifier,
            fullPrice: _fullPrice,
            totalDuration: _totalDuration,
            creator: _creator
        });

        emit ContentListed(_contentId, _contentIdentifier, _fullPrice, _totalDuration, _creator);
    }

    //================================================================
    // User Functions
    //================================================================

    /**
     * @notice Starts or resumes a payment stream for a piece of content.
     * @param _contentId The ID of the content to stream.
     */
    function startStream(bytes32 _contentId) external {
        require(contents[_contentId].contentId != bytes32(0), "Content not listed");
        
        Session storage session = userSessions[msg.sender][_contentId];

        if (session.isActive) {
            // If stream is already active, do nothing.
            return;
        }

        // If this is a new session, set the contentId
        if (session.startTime == 0) {
            session.contentId = _contentId;
            session.startTime = block.timestamp;
        }

        session.isActive = true;
        session.lastUpdateTime = block.timestamp;

        emit PaymentStreamStarted(msg.sender, _contentId, block.timestamp);
    }

    /**
     * @notice Pauses a payment stream.
     * @param _contentId The ID of the content being streamed.
     */
    function pauseStream(bytes32 _contentId) external {
        Session storage session = userSessions[msg.sender][_contentId];
        require(session.isActive, "Stream not active");

        uint256 consumedTime = block.timestamp - session.lastUpdateTime;
        session.accumulatedTime += consumedTime;
        session.isActive = false;
        session.lastUpdateTime = block.timestamp;

        emit PaymentStreamPaused(msg.sender, _contentId, session.accumulatedTime);
    }

    /**
     * @notice Stops a stream and triggers the final payment calculation.
     * @param _contentId The ID of the content to stop.
     */
    function stopStream(bytes32 _contentId) external {
        Session storage session = userSessions[msg.sender][_contentId];
        require(session.startTime > 0, "Stream never started");

        uint256 totalTimeConsumed = session.accumulatedTime;
        if (session.isActive) {
            totalTimeConsumed += block.timestamp - session.lastUpdateTime;
        }

        uint256 paymentAmount = _calculatePayment(
            _contentId,
            totalTimeConsumed
        );

        if (paymentAmount > 0) {
            _deductPayment(msg.sender, _contentId, paymentAmount);
        }

        emit PaymentStreamStopped(msg.sender, _contentId, totalTimeConsumed, paymentAmount);

        // Reset session for potential future viewing
        delete userSessions[msg.sender][_contentId];
    }

    //================================================================
    // Internal & View Functions
    //================================================================

    /**
     * @dev Calculates the payment amount based on consumption time.
     */
    function _calculatePayment(bytes32 _contentId, uint256 _timeConsumed) internal view returns (uint256) {
        Content memory content = contents[_contentId];
        if (_timeConsumed >= content.totalDuration) {
            return content.fullPrice;
        }
        return (content.fullPrice * _timeConsumed) / content.totalDuration;
    }

    /**
     * @dev Deducts payment from the user's vault, prioritizing yield.
     * The wallet must be approved by the user to withdraw from the vault on their behalf.
     */
    function _deductPayment(address _user, bytes32 _contentId, uint256 _amount) internal {
        address creator = contents[_contentId].creator;
        uint256 availableYield = vault.yieldOf(_user);

        if (availableYield >= _amount) {
            // Case 1: Yield is sufficient to cover the entire payment.
            vault.withdraw(_amount, creator, _user);
            emit PaymentDeducted(_user, _contentId, _amount, true);
        } else {
            // Case 2: Yield is insufficient, use all yield and then principal.
            if (availableYield > 0) {
                vault.withdraw(availableYield, creator, _user);
                emit PaymentDeducted(_user, _contentId, availableYield, true);
            }
            
            uint256 remainingAmount = _amount - availableYield;
            vault.withdraw(remainingAmount, creator, _user);
            emit PaymentDeducted(_user, _contentId, remainingAmount, false);
        }
    }
}

