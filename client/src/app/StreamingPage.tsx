'use client';

import { useState, useEffect, useRef } from 'react';
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContracts,
} from 'wagmi';
import {
  parseUnits,
  formatUnits,
  keccak256,
  toBytes,
  stringToBytes,
} from 'viem';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { v4 as uuidv4 } from 'uuid';
import lighthouse from '@lighthouse-web3/sdk';

import {
  MOCK_USDC_ADDRESS,
  YIELD_VAULT_ADDRESS,
  STREAMING_WALLET_ADDRESS,
  MOCK_USDC_ABI,
  YIELD_VAULT_ABI,
  STREAMING_WALLET_ABI,
} from '../contracts';

// --- TYPES ---
type Content = {
  id: string; // uuid
  idBytes32: `0x${string}`;
  title: string;
  description: string;
  price: number;
  duration: number; // in seconds
  metadataCid: string;
  videoCid: string;
  creator: `0x${string}`;
};

// --- HELPER & CHILD COMPONENTS ---

const TransactionStatus = ({
  hash,
  isConfirming,
  isConfirmed,
  error,
  customMessage,
}: {
  hash?: `0x${string}`;
  isConfirming: boolean;
  isConfirmed: boolean;
  error: Error | null;
  customMessage?: string;
}) => {
  if (!hash && !isConfirming && !isConfirmed && !error) return null;
  return (
    <div className='mt-4 text-sm'>
      {isConfirming && (
        <p className='text-yellow-400'>
          {customMessage || 'Transaction pending... please wait.'}
        </p>
      )}
      {isConfirmed && hash && (
        <p className='text-green-400'>
          Transaction successful!{' '}
          <a
            href={`https://sepolia.etherscan.io/tx/${hash}`}
            target='_blank'
            rel='noopener noreferrer'
            className='underline hover:text-green-300'
          >
            View on Sepolia Etherscan
          </a>
        </p>
      )}
      {error && (
        <p className='text-red-400'>
          Error: {(error as any).shortMessage || error.message}
        </p>
      )}
    </div>
  );
};

const StatCard = ({
  title,
  value,
  unit = '',
}: {
  title: string;
  value: string | number;
  unit?: string;
}) => (
  <div className='bg-gray-800 p-4 rounded-lg text-center'>
    <p className='text-sm text-gray-400'>{title}</p>
    <p className='text-2xl font-bold text-white'>
      {value} <span className='text-base font-normal'>{unit}</span>
    </p>
  </div>
);

const AddContentModal = ({
  isOpen,
  onClose,
  onContentListed,
}: {
  isOpen: boolean;
  onClose: () => void;
  onContentListed: (newContent: Content) => void;
}) => {
  const LIGHTHOUSE_API_KEY =
    process.env.NEXT_PUBLIC_LIGHTHOUSE_API_KEY ||
    'ee8c3a9d.cb245ea07e4b4071a9d9f0d308467ba1';

  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [videoFile, setVideoFile] = useState<FileList | null>(null);
  const [uploadingStatus, setUploadingStatus] = useState('');

  const { address } = useAccount();
  const { data: hash, error, isPending, writeContract } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({ hash });
  const MOCK_USDC_DECIMALS = 6;

  useEffect(() => {
    if (isConfirmed) {
      alert('Content successfully listed on-chain!');
      handleClose();
    }
  }, [isConfirmed]);

  const handleClose = () => {
    setTitle('');
    setPrice('');
    setVideoFile(null);
    setUploadingStatus('');
    onClose();
  };

  const getVideoDuration = (file: File): Promise<number> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = function () {
        window.URL.revokeObjectURL(video.src);
        resolve(Math.round(video.duration));
      };
      video.onerror = function () {
        reject('Error loading video file.');
      };
      video.src = window.URL.createObjectURL(file);
    });
  };

  const handleUploadAndList = async () => {
    if (!title || !price || !videoFile || !address || !LIGHTHOUSE_API_KEY) {
      alert(
        'Please fill all fields, select a file, and ensure your wallet is connected. Also check your Lighthouse API Key.'
      );
      return;
    }

    try {
      // 1. Get Video Duration
      setUploadingStatus('Getting video duration...');
      const duration = await getVideoDuration(videoFile[0]);

      // 2. Upload Video to Lighthouse
      setUploadingStatus('Uploading video to Filecoin via Lighthouse...');
      const videoUploadResult = await lighthouse.upload(
        videoFile,
        LIGHTHOUSE_API_KEY
      );
      const videoCid = videoUploadResult.data.Hash;

      // 3. Create and Upload Metadata
      setUploadingStatus('Uploading metadata...');
      const newContentId = uuidv4();
      const metadata = {
        title,
        description: `A video about ${title}`,
        video: `ipfs://${videoCid}`,
        price: parseFloat(price),
        duration,
        creator: address,
        id: newContentId,
      };

      const metadataUploadResult = await lighthouse.uploadText(
        JSON.stringify(metadata),
        LIGHTHOUSE_API_KEY
      );
      const metadataCid = metadataUploadResult.data.Hash;

      // 4. List on Smart Contract
      setUploadingStatus(
        'Waiting for you to confirm the on-chain transaction...'
      );
      const newContentIdBytes32 = keccak256(stringToBytes(newContentId));

      writeContract({
        address: STREAMING_WALLET_ADDRESS,
        abi: STREAMING_WALLET_ABI,
        functionName: 'listContent',
        args: [
          newContentIdBytes32,
          `ipfs://${metadataCid}`,
          parseUnits(price, MOCK_USDC_DECIMALS),
          BigInt(duration),
          address,
        ],
      });

      const newContentForState: Content = {
        id: newContentId,
        idBytes32: newContentIdBytes32,
        title,
        description: metadata.description,
        price: parseFloat(price),
        duration,
        metadataCid,
        videoCid,
        creator: address,
      };
      onContentListed(newContentForState);
    } catch (err) {
      console.error(err);
      setUploadingStatus(`Error: ${(err as Error).message}`);
      alert(`An error occurred: ${(err as Error).message}`);
    }
  };

  if (!isOpen) return null;

  const isUploading =
    !!uploadingStatus && !isPending && !isConfirming && !isConfirmed;

  return (
    <div className='fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50'>
      <div className='bg-gray-800 p-8 rounded-lg w-full max-w-md border border-cyan-500'>
        <h2 className='text-2xl font-bold mb-6'>Add New Content</h2>

        <div className='space-y-4'>
          <input
            type='text'
            placeholder='Video Title'
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className='w-full bg-gray-700 p-3 rounded-lg border border-gray-600'
          />
          <input
            type='number'
            placeholder='Price (in mUSDC)'
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className='w-full bg-gray-700 p-3 rounded-lg border border-gray-600'
          />
          <input
            type='file'
            accept='video/*'
            onChange={(e) => setVideoFile(e.target.files)}
            className='w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-cyan-600 file:text-white hover:file:bg-cyan-700'
          />
        </div>

        <div className='mt-6'>
          {isUploading || isPending || isConfirming ? (
            <div className='text-center p-4 bg-gray-700 rounded-lg'>
              <p className='font-semibold text-cyan-400'>
                {uploadingStatus ||
                  (isPending
                    ? 'Please confirm in wallet...'
                    : 'Confirming transaction...')}
              </p>
              <div className='w-full bg-gray-600 rounded-full h-2.5 mt-2'>
                <div
                  className='bg-cyan-500 h-2.5 rounded-full animate-pulse'
                  style={{ width: isUploading ? '50%' : '100%' }}
                ></div>
              </div>
            </div>
          ) : (
            <button
              onClick={handleUploadAndList}
              className='w-full px-6 py-3 bg-green-600 hover:bg-green-700 rounded-lg font-semibold'
            >
              Upload & List Content
            </button>
          )}
        </div>

        <TransactionStatus
          hash={hash}
          isConfirming={isConfirming}
          isConfirmed={isConfirmed}
          error={error}
        />

        <button
          onClick={handleClose}
          className='w-full mt-4 px-6 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg text-sm'
        >
          Close
        </button>
      </div>
    </div>
  );
};

// --- MAIN PAGE COMPONENT ---

export default function StreamingPage() {
  // --- Constants & Refs ---
  const CONTRACT_OWNER_ADDRESS = '0xE9211a464235cDFbec618d18b716Ae2fF47Ddc43';
  const MOCK_USDC_DECIMALS = 6;

  const videoRef = useRef<HTMLVideoElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // --- State Management ---
  const [depositAmount, setDepositAmount] = useState('');
  const [isStreamActive, setIsStreamActive] = useState(false);
  const [timeWatched, setTimeWatched] = useState(0);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [allContentIds, setAllContentIds] = useState<`0x${string}`[]>([]);
  const [selectedContent, setSelectedContent] = useState<Content | null>(null);
  const [pendingStreamStart, setPendingStreamStart] = useState<Content | null>(
    null
  );

  // --- WAGMI Hooks ---
  const { address, isConnected } = useAccount();
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
    functionName: 'balanceOf',
    args: [address as `0x${string}`],
    query: { enabled: isConnected },
  });

  const { data: vaultAllowance, refetch: refetchVaultAllowance } =
    useReadContract({
      address: MOCK_USDC_ADDRESS,
      abi: MOCK_USDC_ABI,
      functionName: 'allowance',
      args: [address as `0x${string}`, YIELD_VAULT_ADDRESS],
      query: { enabled: isConnected },
    });
  const { data: principalBalance, refetch: refetchPrincipal } = useReadContract(
    {
      address: YIELD_VAULT_ADDRESS,
      abi: YIELD_VAULT_ABI,
      functionName: 'principalOf',
      args: [address as `0x${string}`],
      query: { enabled: isConnected },
    }
  );
  const { data: yieldBalance, refetch: refetchYield } = useReadContract({
    address: YIELD_VAULT_ADDRESS,
    abi: YIELD_VAULT_ABI,
    functionName: 'yieldOf',
    args: [address as `0x${string}`],
    query: { enabled: isConnected },
  });
  const {
    data: streamingWalletAllowance,
    refetch: refetchStreamingWalletAllowance,
  } = useReadContract({
    address: YIELD_VAULT_ADDRESS,
    abi: YIELD_VAULT_ABI,
    functionName: 'allowance',
    args: [address as `0x${string}`, STREAMING_WALLET_ADDRESS],
    query: { enabled: isConnected },
  });

  const { data: fetchedContentsData, refetch: refetchAllContents } =
    useReadContracts({
      contracts: allContentIds.map((id) => ({
        address: STREAMING_WALLET_ADDRESS,
        abi: STREAMING_WALLET_ABI,
        functionName: 'contents',
        args: [id],
      })),
      query: { enabled: allContentIds.length > 0 },
    });

  // --- Derived State ---
  const formattedUsdcBalance = usdcBalance
    ? Number(formatUnits(usdcBalance as bigint, MOCK_USDC_DECIMALS)).toFixed(2)
    : '0.00';
  const formattedPrincipal = principalBalance
    ? Number(
        formatUnits(principalBalance as bigint, MOCK_USDC_DECIMALS)
      ).toFixed(2)
    : '0.00';
  const formattedYield = yieldBalance
    ? Number(formatUnits(yieldBalance as bigint, MOCK_USDC_DECIMALS)).toFixed(2)
    : '0.00';
  const hasDeposited = principalBalance
    ? (principalBalance as bigint) > BigInt(0)
    : false;
  const needsStreamingApproval =
    hasDeposited &&
    (!streamingWalletAllowance ||
      (streamingWalletAllowance as bigint) === BigInt(0));
  const estimatedCost = selectedContent
    ? (timeWatched / selectedContent.duration) * selectedContent.price
    : 0;

  // --- Effects ---
  useEffect(() => {
    // Handle successful confirmations
    if (isConfirmed) {
      if (pendingAction === 'mint' && isOwner) {
        handleApproveForYield();
      } else if (pendingAction === 'approveYield') {
        handleAddYield();
      } else if (pendingAction === 'addYield') {
        setPendingAction(null);
      }

      if (pendingStreamStart) {
        setIsStreamActive(true);
        if (videoRef.current) {
          videoRef.current.play();
        }
        setPendingStreamStart(null);
      }

      refetchAllData();
    }

    // Handle errors
    if (error && pendingStreamStart) {
      alert(
        `Failed to start the stream: ${
          (error as any).shortMessage || error.message
        }`
      );
      setPendingStreamStart(null);
    }
  }, [isConfirmed, error]);

  useEffect(() => {
    if (isStreamActive) {
      timerRef.current = setInterval(
        () => setTimeWatched((prev) => prev + 1),
        1000
      );
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isStreamActive]);

  const handleContentListed = (newContent: Content) => {
    setAllContentIds((prev) => [...prev, newContent.idBytes32]);
    refetchAllContents();
  };

  // --- Contract Interaction Functions ---
  const refetchAllData = () => {
    refetchUsdcBalance();
    refetchVaultAllowance();
    refetchPrincipal();
    refetchYield();
    refetchStreamingWalletAllowance();
    refetchAllContents();
  };

  const handleMint = () => {
    if (isOwner) {
      setPendingAction('mint');
    }
    writeContract({
      address: MOCK_USDC_ADDRESS,
      abi: MOCK_USDC_ABI,
      functionName: 'mint',
      args: [address, parseUnits('100', MOCK_USDC_DECIMALS)],
    });
  };
  const handleApproveForYield = () => {
    setPendingAction('approveYield');
    writeContract({
      address: MOCK_USDC_ADDRESS,
      abi: MOCK_USDC_ABI,
      functionName: 'approve',
      args: [YIELD_VAULT_ADDRESS, parseUnits('20', MOCK_USDC_DECIMALS)],
    });
  };
  const handleAddYield = () => {
    setPendingAction('addYield');
    writeContract(
      {
        address: YIELD_VAULT_ADDRESS,
        abi: YIELD_VAULT_ABI,
        functionName: 'addMockYield',
        args: [parseUnits('20', MOCK_USDC_DECIMALS)],
      },
      { onSuccess: () => setPendingAction(null) }
    );
  };
  const handleApprove = () => {
    writeContract({
      address: MOCK_USDC_ADDRESS,
      abi: MOCK_USDC_ABI,
      functionName: 'approve',
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
      functionName: 'deposit',
      args: [parseUnits(depositAmount, MOCK_USDC_DECIMALS), address],
    });
  };
  const handleApproveStreaming = () => {
    const MAX_UINT256 = BigInt(
      '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
    );
    writeContract({
      address: YIELD_VAULT_ADDRESS,
      abi: YIELD_VAULT_ABI,
      functionName: 'approve',
      args: [STREAMING_WALLET_ADDRESS, MAX_UINT256],
    });
  };

  // --- Stream Control ---
  const handleStartStream = () => {
    if (!selectedContent) return;

    const totalVaultBalance =
      ((principalBalance as bigint) || BigInt(0)) +
      ((yieldBalance as bigint) || BigInt(0));
    if (totalVaultBalance === BigInt(0)) {
      alert(
        'You have no funds in the vault. Please deposit mUSDC to start streaming.'
      );
      return;
    }

    setPendingStreamStart(selectedContent);
    writeContract({
      address: STREAMING_WALLET_ADDRESS,
      abi: STREAMING_WALLET_ABI,
      functionName: 'startStream',
      args: [selectedContent.idBytes32],
    });
  };

  const handlePauseStream = () => {
    if (!selectedContent) return;
    writeContract({
      address: STREAMING_WALLET_ADDRESS,
      abi: STREAMING_WALLET_ABI,
      functionName: 'pauseStream',
      args: [selectedContent.idBytes32],
    });
    setIsStreamActive(false);
    if (videoRef.current) videoRef.current.pause();
  };
  const handleStopStream = () => {
    if (!selectedContent) return;
    writeContract({
      address: STREAMING_WALLET_ADDRESS,
      abi: STREAMING_WALLET_ABI,
      functionName: 'stopStream',
      args: [selectedContent.idBytes32],
    });
    setIsStreamActive(false);
    setTimeWatched(0);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  };

  // --- UI Rendering ---
  const needsUsdcApproval =
    parseFloat(depositAmount) > 0 &&
    (!vaultAllowance ||
      parseUnits(depositAmount, MOCK_USDC_DECIMALS) >
        (vaultAllowance as bigint));
  const canDeposit =
    parseFloat(depositAmount) > 0 &&
    !needsUsdcApproval &&
    usdcBalance &&
    (usdcBalance as bigint) >= parseUnits(depositAmount, MOCK_USDC_DECIMALS);

  return (
    <main className='min-h-screen bg-gray-900 text-white p-4 sm:p-8'>
      <AddContentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onContentListed={handleContentListed}
      />

      <header className='flex justify-between items-center mb-8'>
        <h1 className='text-3xl font-bold text-cyan-400'>YieldStream</h1>
        <ConnectButton />
      </header>

      {!isConnected ? (
        <div className='text-center bg-gray-800 p-8 rounded-lg'>
          <h2 className='text-2xl font-semibold'>Welcome to YieldStream</h2>
          <p className='text-gray-400 mt-2'>
            Connect your wallet to get started.
          </p>
        </div>
      ) : (
        <div className='space-y-8'>
          {isOwner && (
            <section className='bg-gray-800 p-6 rounded-lg border border-cyan-500'>
              <h2 className='text-xl font-semibold mb-4 text-cyan-300'>
                Admin Panel
              </h2>
              <button
                onClick={() => setIsModalOpen(true)}
                className='w-full px-6 py-3 bg-cyan-600 hover:bg-cyan-700 rounded-lg font-semibold transition-colors'
              >
                Add New Content
              </button>
            </section>
          )}

          <section className='bg-gray-800 p-6 rounded-lg'>
            <h2 className='text-xl font-semibold mb-4'>Your DeFi Wallet</h2>
            <div className='grid grid-cols-1 md:grid-cols-3 gap-4 mb-6'>
              <StatCard
                title='mUSDC Balance'
                value={formattedUsdcBalance}
                unit='mUSDC'
              />
              <StatCard
                title='Vault Principal'
                value={formattedPrincipal}
                unit='mUSDC'
              />
              <StatCard
                title='Vault Yield'
                value={formattedYield}
                unit='mUSDC'
              />
            </div>
            <div className='space-y-4'>
              <button
                onClick={handleMint}
                disabled={isPending}
                className='w-full px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 rounded-lg font-semibold transition-colors'
              >
                Get 100 Test mUSDC {isOwner && '(+20% Yield)'}
              </button>
              <div className='flex flex-col sm:flex-row gap-4'>
                <input
                  type='number'
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  placeholder='Amount to deposit'
                  className='flex-grow bg-gray-700 p-3 rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-cyan-500'
                />
                <button
                  onClick={handleApprove}
                  disabled={!needsUsdcApproval || isPending}
                  className='px-6 py-3 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 rounded-lg font-semibold transition-colors'
                >
                  1. Approve mUSDC
                </button>
                <button
                  onClick={handleDeposit}
                  disabled={!canDeposit || isPending}
                  className='px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded-lg font-semibold transition-colors'
                >
                  2. Deposit
                </button>
              </div>
              {hasDeposited && (
                <div className='pt-4 border-t border-gray-700'>
                  <button
                    onClick={handleApproveStreaming}
                    disabled={!needsStreamingApproval || isPending}
                    className='w-full px-6 py-3 bg-teal-600 hover:bg-teal-700 disabled:bg-gray-600 rounded-lg font-semibold transition-colors'
                  >
                    {needsStreamingApproval
                      ? '3. Approve Streaming Contract'
                      : 'Streaming Approved'}
                  </button>
                  <p className='text-xs text-center mt-2 text-gray-400'>
                    This allows the streaming contract to deduct funds from your
                    vault balance for payment.
                  </p>
                </div>
              )}
            </div>
          </section>

          <section className='bg-gray-800 p-6 rounded-lg'>
            <h2 className='text-xl font-semibold mb-4'>Available Content</h2>
            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
              {fetchedContentsData?.map((contentResult, index) => {
                if (!contentResult.result) return null;
                const [, metadataCid, fullPrice, totalDuration, creator] =
                  contentResult.result as any;
                // In a production app, you'd fetch the metadata JSON from IPFS to get the title.
                // For this demo, we'll keep it simple.
                return (
                  <div
                    key={index}
                    onClick={() =>
                      setSelectedContent({
                        ...selectedContent,
                        idBytes32: allContentIds[index],
                        metadataCid: metadataCid.replace('ipfs://', ''),
                        price: Number(
                          formatUnits(fullPrice, MOCK_USDC_DECIMALS)
                        ),
                        duration: Number(totalDuration),
                        creator,
                        title: `Content ${index + 1}`,
                      } as Content)
                    }
                    className='border-2 border-transparent hover:border-cyan-500 cursor-pointer p-4 bg-gray-700 rounded-lg'
                  >
                    <p className='font-bold'>Content #{index + 1}</p>
                    <p className='text-xs text-gray-400 truncate'>
                      Metadata: {metadataCid.replace('ipfs://', '')}
                    </p>
                    <p className='text-sm'>
                      Price:{' '}
                      {Number(formatUnits(fullPrice, MOCK_USDC_DECIMALS))} mUSDC
                    </p>
                  </div>
                );
              })}
              {allContentIds.length === 0 && (
                <p className='text-gray-400'>
                  No content has been listed by the owner yet.
                </p>
              )}
            </div>
          </section>

          {selectedContent && (
            <section className='bg-gray-800 p-6 rounded-lg'>
              <h2 className='text-xl font-semibold mb-4'>
                Now Streaming: {selectedContent.title}
              </h2>
              <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
                <div className='lg:col-span-2'>
                  <div className='aspect-video bg-black rounded-lg overflow-hidden'>
                    <video
                      ref={videoRef}
                      src={`https://gateway.lighthouse.storage/ipfs/${
                        selectedContent.videoCid || selectedContent.metadataCid
                      }`}
                      controls={false}
                      className='w-full h-full'
                    />
                  </div>
                </div>
                <div className='flex flex-col justify-between bg-gray-700 p-4 rounded-lg'>
                  <div>
                    <h3 className='text-lg font-bold'>
                      {selectedContent.title}
                    </h3>
                    <p className='text-sm text-gray-400'>
                      Total Duration:{' '}
                      {Math.floor(selectedContent.duration / 60)}m{' '}
                      {selectedContent.duration % 60}s
                    </p>
                    <p className='text-sm text-gray-400'>
                      Full Price: ${selectedContent.price} mUSDC
                    </p>
                    {needsStreamingApproval && hasDeposited && (
                      <p className='text-sm text-yellow-400 mt-2'>
                        Please approve the streaming contract above before
                        playing.
                      </p>
                    )}
                  </div>
                  <div className='space-y-3 mt-4'>
                    <div className='text-center'>
                      <p className='text-sm text-gray-300'>
                        Time Watched: {Math.floor(timeWatched / 60)}m{' '}
                        {timeWatched % 60}s
                      </p>
                      <p className='text-lg font-semibold text-cyan-400'>
                        Cost: ${estimatedCost.toFixed(4)} mUSDC
                      </p>
                    </div>
                    <div className='grid grid-cols-3 gap-2'>
                      <button
                        onClick={handleStartStream}
                        disabled={
                          isPending ||
                          isStreamActive ||
                          needsStreamingApproval ||
                          !!pendingStreamStart
                        }
                        className='px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded-lg font-semibold'
                      >
                        {pendingStreamStart ? 'Starting...' : 'Play'}
                      </button>
                      <button
                        onClick={handlePauseStream}
                        disabled={isPending || !isStreamActive}
                        className='px-4 py-2 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 rounded-lg font-semibold'
                      >
                        Pause
                      </button>
                      <button
                        onClick={handleStopStream}
                        disabled={isPending}
                        className='px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 rounded-lg font-semibold'
                      >
                        Stop
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          <section className='bg-gray-800 p-6 rounded-lg'>
            <h2 className='text-xl font-semibold mb-2'>Transaction Status</h2>
            <TransactionStatus
              hash={hash}
              isConfirming={isConfirming}
              isConfirmed={isConfirmed}
              error={error}
            />
            {isPending && (
              <p className='text-blue-400'>
                Please confirm the transaction in your wallet...
              </p>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
