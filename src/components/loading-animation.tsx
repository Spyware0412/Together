
"use client";

import { DotLottiePlayer } from '@dotlottie/react-player';

export const LoadingAnimation = () => {
  return (
    <DotLottiePlayer
        src="https://assets4.lottiefiles.com/packages/lf20_x62chJ.json"
        autoplay
        loop
        style={{ width: '300px', height: '300px' }}
    />
  );
};
