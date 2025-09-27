import Image from "next/image";
import { ConnectButton } from '@rainbow-me/rainbowkit';
import StreamingPage from "./StreamingPage";


export default function Home() {
  return (
    <div className="">
     <ConnectButton />
     <div>
      <StreamingPage />
     </div>
    </div>
  );
}
