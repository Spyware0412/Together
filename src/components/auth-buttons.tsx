"use client";

import { Button } from "@/components/ui/button";

const GoogleIcon = () => (
    <svg className="mr-2 h-4 w-4" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512">
        <path fill="currentColor" d="M488 261.8C488 403.3 381.5 512 244 512S0 403.3 0 261.8 106.5 11.8 244 11.8S488 120.3 488 261.8zm-252.1-5.1c-22.4 0-41.3-4.7-56.7-14.1-15.4-9.4-26.6-23.4-33.6-41.3H109.4v54.8h112.4c-4.7 22.4-14.1 40-28.2 52.8-14.1 12.8-32.9 19.1-56.7 19.1-23.8 0-45.5-6.7-65.1-20.1-19.6-13.4-34.5-32.2-44.7-56.1H49.1v51.1c21.1 34.5 51.1 60.1 89.9 76.8 38.8 16.7 82.3 25 129.8 25 39.5 0 74.4-7.4 104.7-22.1 30.3-14.7 54.5-35.8 72.4-63.4l-52.8-41.3c-7 15.4-17.4 27.6-31.2 36.6-13.8 9-30.3 13.4-49.4 13.4zM244 118.8c33.3 0 61 11.4 83.1 34.3l38.8-38.8C334.6 82.5 292.8 64 244 64 195.2 64 151.7 72.9 113.9 90.6 76.1 108.3 47.1 133.6 27 166.4l52.8 41.3c10.2-22.8 25.1-40.9 44.7-54.2 19.6-13.3 42-20 66.5-20z"></path>
    </svg>
);

export function AuthButtons() {
  return (
    <div className="space-y-3">
      <Button variant="outline" className="w-full">
        <GoogleIcon />
        Sign in with Google
      </Button>
      {/* Add other providers here if needed */}
    </div>
  );
}
