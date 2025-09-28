import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { sepolia } from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: 'RainbowKit demo',
  projectId: '04ba0a39dfea93bd78366558bdc87aff',
  chains: [sepolia],
  ssr: true,
});
