"use client";

import { useState, useEffect, useRef } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import {
  parseUnits,
  formatUnits,
  keccak256,
  toBytes,
  stringToBytes,
} from "viem";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
  MOCK_USDC_ADDRESS,
  YIELD_VAULT_ADDRESS,
  STREAMING_WALLET_ADDRESS,
  MOCK_USDC_ABI,
  YIELD_VAULT_ABI,
  STREAMING_WALLET_ABI,
} from "@/contracts";

// --- Helper Components ---

const TransactionStatus = ({
  hash,
  isConfirming,
  isConfirmed,
  error,
}: {
  hash?: `0x${string}`;
  isConfirming: boolean;
  isConfirmed: boolean;
  error: Error | null;
}) => {
  if (!hash && !isConfirming && !isConfirmed && !error) return null;

  return (
    <div className="mt-4 text-sm">
      {isConfirming && (
        <p className="text-yellow-400">Transaction pending... please wait.</p>
      )}
      {isConfirmed && hash && (
        <p className="text-green-400">
          Transaction successful!{" "}
          <a
            href={`https://amoy.polygonscan.com/tx/${hash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-green-300"
          >
            View on AmoyScan
          </a>
        </p>
      )}
      {error && (
        <p className="text-red-400">
          Error: {(error as any).shortMessage || error.message}
        </p>
      )}
    </div>
  );
};

const StatCard = ({
  title,
  value,
  unit = "",
}: {
  title: string;
  value: string | number;
  unit?: string;
}) => (
  <div className="bg-gray-800 p-4 rounded-lg text-center">
    <p className="text-sm text-gray-400">{title}</p>
    <p className="text-2xl font-bold text-white">
      {value} <span className="text-base font-normal">{unit}</span>
    </p>
  </div>
);

// --- Main Component ---

export default function StreamingPage() {
  // --- Constants & Refs ---
  const CONTRACT_OWNER_ADDRESS = "0x58c291D788be8fF99CC5565D41970f67A7CDF33D";
  const CONTENT_ID_STRING = "onepiece_ep1";
  const CONTENT_ID_BYTES32 = keccak256(stringToBytes(CONTENT_ID_STRING));
  const VIDEO_DURATION_SECONDS = 25 * 60; // 25 minutes
  const VIDEO_PRICE_USD = 5; // $5 for the full video
  const MOCK_USDC_DECIMALS = 6;

  const videoRef = useRef<HTMLVideoElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // --- State Management ---
  const [depositAmount, setDepositAmount] = useState("");
  const [isStreamActive, setIsStreamActive] = useState(false);
  const [timeWatched, setTimeWatched] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState(0);

  // --- WAGMI Hooks ---
  const { address, isConnected, chain } = useAccount();
  const { data: hash, error, isPending, writeContract } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({ hash });
  const isOwner =
    isConnected &&
    address?.toLowerCase() === CONTRACT_OWNER_ADDRESS.toLowerCase();

  // --- Contract Read Hooks ---
  const { data: usdcBalance, refetch: refetchUsdcBalance } = useReadContract({
    address: MOCK_USDC_ADDRESS,
    abi: MOCK_USDC_ABI,
    functionName: "balanceOf",
    args: [address as `0x${string}`],
    query: { enabled: isConnected },
  });

  const { data: vaultAllowance, refetch: refetchVaultAllowance } =
    useReadContract({
      address: MOCK_USDC_ADDRESS,
      abi: MOCK_USDC_ABI,
      functionName: "allowance",
      args: [address as `0x${string}`, YIELD_VAULT_ADDRESS],
      query: { enabled: isConnected },
    });

  const { data: principalBalance, refetch: refetchPrincipal } = useReadContract(
    {
      address: YIELD_VAULT_ADDRESS,
      abi: YIELD_VAULT_ABI,
      functionName: "principalOf",
      args: [address as `0x${string}`],
      query: { enabled: isConnected },
    }
  );

  const { data: yieldBalance, refetch: refetchYield } = useReadContract({
    address: YIELD_VAULT_ADDRESS,
    abi: YIELD_VAULT_ABI,
    functionName: "yieldOf",
    args: [address as `0x${string}`],
    query: { enabled: isConnected },
  });

  const { data: contentListed } = useReadContract({
    address: STREAMING_WALLET_ADDRESS,
    abi: STREAMING_WALLET_ABI,
    functionName: "contents",
    args: [CONTENT_ID_BYTES32],
  });

  // --- Derived State ---
  const formattedUsdcBalance = usdcBalance
    ? Number(formatUnits(usdcBalance, MOCK_USDC_DECIMALS)).toFixed(2)
    : "0.00";
  const formattedPrincipal = principalBalance
    ? Number(formatUnits(principalBalance, MOCK_USDC_DECIMALS)).toFixed(2)
    : "0.00";
  const formattedYield = yieldBalance
    ? Number(formatUnits(yieldBalance, MOCK_USDC_DECIMALS)).toFixed(2)
    : "0.00";
  const isContentListed = contentListed
    ? (contentListed as any)[0] !==
      "0x0000000000000000000000000000000000000000000000000000000000000000"
    : false;

  // --- Effects ---
  useEffect(() => {
    if (isConfirmed) {
      refetchAllData();
    }
  }, [isConfirmed]);

  useEffect(() => {
    if (isStreamActive) {
      timerRef.current = setInterval(() => {
        setTimeWatched((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isStreamActive]);

  // --- Contract Interaction Functions ---
  const refetchAllData = () => {
    refetchUsdcBalance();
    refetchVaultAllowance();
    refetchPrincipal();
    refetchYield();
  };

  const handleListContent = () => {
    try {
      writeContract({
        address: STREAMING_WALLET_ADDRESS,
        abi: STREAMING_WALLET_ABI,
        functionName: "listContent",
        args: [
          CONTENT_ID_BYTES32,
          "ipfs://bafybeigdv5qt3krvk3cjndz3sa2v5qfrqk4fr5tzg55j2hsnmfgvi4gqdy/onepiece_ep1.mp4",
          parseUnits(VIDEO_PRICE_USD.toString(), MOCK_USDC_DECIMALS),
          BigInt(VIDEO_DURATION_SECONDS),
          CONTRACT_OWNER_ADDRESS,
        ],
      });
    } catch (error) {
      console.log("great error....", error);
    }
  };

  const handleMint = () => {
    writeContract({
      address: MOCK_USDC_ADDRESS,
      abi: MOCK_USDC_ABI,
      functionName: "mint",
      args: [address, parseUnits("100", MOCK_USDC_DECIMALS)],
    });
  };

  const handleApprove = () => {
    writeContract({
      address: MOCK_USDC_ADDRESS,
      abi: MOCK_USDC_ABI,
      functionName: "approve",
      args: [
        YIELD_VAULT_ADDRESS,
        parseUnits(depositAmount, MOCK_USDC_DECIMALS),
      ],
    });
  };

  const handleDeposit = () => {
    writeContract({
      address: YIELD_VAULT_ADDRESS,
      abi: YIELD_VAULT_ABI,
      functionName: "deposit",
      args: [parseUnits(depositAmount, MOCK_USDC_DECIMALS), address],
    });
  };

  const handleStartStream = () => {
    writeContract({
      address: STREAMING_WALLET_ADDRESS,
      abi: STREAMING_WALLET_ABI,
      functionName: "startStream",
      args: [CONTENT_ID_BYTES32],
    });
    setIsStreamActive(true);
    if (videoRef.current) videoRef.current.play();
  };

  const handlePauseStream = () => {
    writeContract({
      address: STREAMING_WALLET_ADDRESS,
      abi: STREAMING_WALLET_ABI,
      functionName: "pauseStream",
      args: [CONTENT_ID_BYTES32],
    });
    setIsStreamActive(false);
    if (videoRef.current) videoRef.current.pause();
  };

  const handleStopStream = () => {
    writeContract({
      address: STREAMING_WALLET_ADDRESS,
      abi: STREAMING_WALLET_ABI,
      functionName: "stopStream",
      args: [CONTENT_ID_BYTES32],
    });
    setIsStreamActive(false);
    setTimeWatched(0);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  };

  // --- UI Rendering ---
  const needsApproval =
    parseFloat(depositAmount) > 0 &&
    (!vaultAllowance ||
      parseUnits(depositAmount, MOCK_USDC_DECIMALS) >
        (vaultAllowance as bigint));
  const canDeposit =
    parseFloat(depositAmount) > 0 &&
    !needsApproval &&
    usdcBalance &&
    usdcBalance >= parseUnits(depositAmount, MOCK_USDC_DECIMALS);
  const estimatedCost =
    (timeWatched / VIDEO_DURATION_SECONDS) * VIDEO_PRICE_USD;

  return (
    <main className="min-h-screen bg-gray-900 text-white p-4 sm:p-8">
      <header className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-cyan-400">YieldStream</h1>
        <ConnectButton />
      </header>

      {!isConnected ? (
        <div className="text-center bg-gray-800 p-8 rounded-lg">
          <h2 className="text-2xl font-semibold">Welcome to YieldStream</h2>
          <p className="text-gray-400 mt-2">
            Connect your wallet to get started.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Admin Panel */}
          {isOwner && (
            <section className="bg-gray-800 p-6 rounded-lg border border-cyan-500">
              <h2 className="text-xl font-semibold mb-4 text-cyan-300">
                Admin Panel
              </h2>
              <p className="text-gray-400 mb-4">
                This section is visible only to the contract owner.
              </p>
              <button
                onClick={handleListContent}
                disabled={isPending || isContentListed}
                className="w-full px-6 py-3 bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-600 rounded-lg font-semibold transition-colors"
              >
                {isContentListed
                  ? "Content Already Listed"
                  : "List Video Content"}
              </button>
            </section>
          )}

          {/* DeFi Wallet Section */}
          <section className="bg-gray-800 p-6 rounded-lg">
            <h2 className="text-xl font-semibold mb-4">Your DeFi Wallet</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <StatCard
                title="mUSDC Balance"
                value={formattedUsdcBalance}
                unit="mUSDC"
              />
              <StatCard
                title="Vault Principal"
                value={formattedPrincipal}
                unit="mUSDC"
              />
              <StatCard
                title="Vault Yield"
                value={formattedYield}
                unit="mUSDC"
              />
            </div>
            <div className="space-y-4">
              <button
                onClick={handleMint}
                disabled={isPending}
                className="w-full px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 rounded-lg font-semibold transition-colors"
              >
                Get 100 Test mUSDC
              </button>
              <div className="flex flex-col sm:flex-row gap-4">
                <input
                  type="number"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  placeholder="Amount to deposit"
                  className="flex-grow bg-gray-700 p-3 rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
                <button
                  onClick={handleApprove}
                  disabled={!needsApproval || isPending}
                  className="px-6 py-3 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 rounded-lg font-semibold transition-colors"
                >
                  Approve
                </button>
                <button
                  onClick={handleDeposit}
                  disabled={!canDeposit || isPending}
                  className="px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded-lg font-semibold transition-colors"
                >
                  Deposit
                </button>
              </div>
            </div>
          </section>

          {/* Video Streaming Section */}
          <section className="bg-gray-800 p-6 rounded-lg">
            <h2 className="text-xl font-semibold mb-4">Video Stream</h2>
            {!isContentListed ? (
              <p className="text-yellow-400 text-center">
                Video content has not been listed by the owner yet.
              </p>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <div className="aspect-video bg-black rounded-lg overflow-hidden">
                    <video
                      ref={videoRef}
                      src="/onepeice_ep1.mp4"
                      poster="https://i.pinimg.com/1200x/b2/39/22/b23922269a734429a6ca12a2390f5af8.jpg"
                      controls={false}
                      className="w-full h-full"
                    />
                  </div>
                </div>
                <div className="flex flex-col justify-between bg-gray-700 p-4 rounded-lg">
                  <div>
                    <h3 className="text-lg font-bold">One Piece - Episode 1</h3>
                    <p className="text-sm text-gray-400">
                      Total Duration: 25 minutes
                    </p>
                    <p className="text-sm text-gray-400">
                      Full Price: ${VIDEO_PRICE_USD} mUSDC
                    </p>
                  </div>
                  <div className="space-y-3 mt-4">
                    <div className="text-center">
                      <p className="text-sm text-gray-300">
                        Time Watched: {Math.floor(timeWatched / 60)}m{" "}
                        {timeWatched % 60}s
                      </p>
                      <p className="text-lg font-semibold text-cyan-400">
                        Cost: ${estimatedCost.toFixed(4)} mUSDC
                      </p>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={handleStartStream}
                        disabled={isPending || isStreamActive}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded-lg font-semibold transition-colors"
                      >
                        Play
                      </button>
                      <button
                        onClick={handlePauseStream}
                        disabled={isPending || !isStreamActive}
                        className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 rounded-lg font-semibold transition-colors"
                      >
                        Pause
                      </button>
                      <button
                        onClick={handleStopStream}
                        disabled={isPending}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 rounded-lg font-semibold transition-colors"
                      >
                        Stop
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Transaction Status Section */}
          <section className="bg-gray-800 p-6 rounded-lg">
            <h2 className="text-xl font-semibold mb-2">Transaction Status</h2>
            <TransactionStatus
              hash={hash}
              isConfirming={isConfirming}
              isConfirmed={isConfirmed}
              error={error}
            />
            {isPending && (
              <p className="text-blue-400">
                Please confirm the transaction in your wallet...
              </p>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
