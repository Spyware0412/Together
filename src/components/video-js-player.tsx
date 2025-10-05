
"use client";

import React, { useEffect, useRef } from 'react';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';

interface VideoJsPlayerProps {
  options: videojs.PlayerOptions;
  onReady?: (player: videojs.Player) => void;
}

export const VideoJsPlayer: React.FC<VideoJsPlayerProps> = ({ options, onReady }) => {
  const videoRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<videojs.Player | null>(null);

  useEffect(() => {
    // Make sure Video.js player is only initialized once
    if (!playerRef.current && videoRef.current) {
      const videoElement = document.createElement("video-js");
      videoElement.classList.add("vjs-fill");
      videoElement.classList.add("vjs-big-play-centered");
      videoRef.current.appendChild(videoElement);

      const player = playerRef.current = videojs(videoElement, options, () => {
        player.log('player is ready');
        onReady && onReady(player);
      });
    }

  }, [options, onReady]);


  useEffect(() => {
    const player = playerRef.current;
    if (player) {
      player.autoplay(options.autoplay || false);
      player.src(options.sources || []);
    }
  }, [options.sources, options.autoplay]);


  // Dispose the Video.js player when the component unmounts
  useEffect(() => {
    const player = playerRef.current;

    return () => {
      if (player && !player.isDisposed()) {
        player.dispose();
        playerRef.current = null;
      }
    };
  }, []);

  return (
    <div data-vjs-player className="w-full h-full">
      <div ref={videoRef} className="w-full h-full" />
    </div>
  );
};
