
'use client';

import { useEffect } from 'react';

declare global {
  interface Window {
    tsParticles: any;
  }
}

export function ParticlesBackground() {
  useEffect(() => {
    const checkParticles = () => {
      if (window.tsParticles) {
        window.tsParticles.load({
          id: 'tsparticles',
          options: {
            background: {
              color: {
                value: 'transparent',
              },
            },
            fpsLimit: 60,
            interactivity: {
              events: {
                onHover: {
                  enable: true,
                  mode: 'repulse',
                },
              },
              modes: {
                repulse: {
                  distance: 100,
                  duration: 0.4,
                },
              },
            },
            particles: {
              color: {
                value: '#ffffff',
              },
              links: {
                color: '#ffffff',
                distance: 150,
                enable: true,
                opacity: 0.2,
                width: 1,
              },
              move: {
                direction: 'none',
                enable: true,
                outModes: {
                  default: 'out',
                },
                random: false,
                speed: 1,
                straight: false,
              },
              number: {
                density: {
                  enable: true,
                },
                value: 80,
              },
              opacity: {
                value: 0.2,
              },
              shape: {
                type: 'circle',
              },
              size: {
                value: { min: 1, max: 3 },
              },
            },
            detectRetina: true,
          },
        });
      } else {
        // If tsParticles is not available, try again after a short delay
        setTimeout(checkParticles, 100);
      }
    };

    checkParticles();
  }, []);

  return <div id="tsparticles" className="absolute top-0 left-0 w-full h-full z-0" />;
}
