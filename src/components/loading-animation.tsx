
"use client";

import { DotLottiePlayer } from '@dotlottie/react-player';

interface LoadingAnimationProps {
  width?: string;
  height?: string;
}

export const LoadingAnimation = ({ width = '300px', height = '300px' }: LoadingAnimationProps) => {
  return (
    <DotLottiePlayer
        src="https://assets4.lottiefiles.com/packages/lf20_x62chJ.json"
        autoplay
        loop
        style={{ width, height }}
    />
  );
};
