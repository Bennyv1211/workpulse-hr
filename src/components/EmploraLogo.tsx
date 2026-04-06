import React from 'react';
import Svg, { Defs, LinearGradient, Stop, Rect, Path, G } from 'react-native-svg';

interface LogoProps {
  size?: number;
}

// Square icon logo - for app icon, small logos
export const EmploraIcon = ({ size = 100 }: LogoProps) => (
  <Svg width={size} height={size} viewBox="0 0 140 140">
    <Defs>
      <LinearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <Stop offset="0%" stopColor="#7B6EF6" />
        <Stop offset="100%" stopColor="#4A90E2" />
      </LinearGradient>
      <LinearGradient id="pillGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <Stop offset="0%" stopColor="#F97060" />
        <Stop offset="100%" stopColor="#FBAF3F" />
      </LinearGradient>
      <LinearGradient id="letterGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <Stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
        <Stop offset="100%" stopColor="#dde3ff" stopOpacity="1" />
      </LinearGradient>
    </Defs>
    
    {/* Rounded square background */}
    <Rect x="0" y="0" width="140" height="140" rx="32" fill="url(#bgGrad)" />
    
    {/* Letter E: vertical spine */}
    <Rect x="36" y="30" width="18" height="80" rx="9" fill="url(#letterGrad)" />
    
    {/* E horizontal bars */}
    <Rect x="54" y="30" width="45" height="14" rx="7" fill="url(#letterGrad)" />
    <Rect x="54" y="63" width="35" height="14" rx="7" fill="url(#letterGrad)" />
    <Rect x="54" y="96" width="45" height="14" rx="7" fill="url(#letterGrad)" />
    
    {/* Orange accent pill */}
    <Rect x="85" y="45" width="24" height="8" rx="4" fill="url(#pillGrad)" />
  </Svg>
);

// Wordmark logo - for login screen, headers
export const EmploraWordmark = ({ size = 100 }: LogoProps) => {
  const width = size * 4.4;
  const height = size;
  
  return (
    <Svg width={width} height={height} viewBox="0 0 440 110">
      <Defs>
        <LinearGradient id="bgGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#7B6EF6" />
          <Stop offset="100%" stopColor="#4A90E2" />
        </LinearGradient>
        <LinearGradient id="pillGrad2" x1="0%" y1="0%" x2="100%" y2="0%">
          <Stop offset="0%" stopColor="#F97060" />
          <Stop offset="100%" stopColor="#FBAF3F" />
        </LinearGradient>
        <LinearGradient id="letterGrad2" x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor="#ffffff" />
          <Stop offset="100%" stopColor="#dde3ff" />
        </LinearGradient>
      </Defs>
      
      {/* Icon background square */}
      <Rect x="0" y="5" width="100" height="100" rx="24" fill="url(#bgGrad2)" />
      
      {/* E: vertical spine */}
      <Rect x="26" y="24" width="13" height="62" rx="6.5" fill="url(#letterGrad2)" />
      
      {/* E horizontal bars */}
      <Rect x="39" y="24" width="36" height="10" rx="5" fill="url(#letterGrad2)" />
      <Rect x="39" y="50" width="28" height="10" rx="5" fill="url(#letterGrad2)" />
      <Rect x="39" y="76" width="36" height="10" rx="5" fill="url(#letterGrad2)" />
      
      {/* Orange accent pill */}
      <Rect x="62" y="36" width="18" height="6" rx="3" fill="url(#pillGrad2)" />
      
      {/* Text: "mplora" */}
      <G fill="#1E293B">
        {/* m */}
        <Path d="M130,42 h6 v6 c2-4,6-7,11-7 c5,0,8,2,10,6 c2-4,6-6,12-6 c8,0,12,5,12,14 v28 h-7 V57 c0-6-2-9-7-9 c-5,0-8,4-8,10 v25 h-7 V57 c0-6-2-9-7-9 c-5,0-8,4-8,10 v25 h-7 V42z" />
        {/* p */}
        <Path d="M192,42 h6 v5 c3-4,7-6,12-6 c10,0,17,8,17,21 s-7,21-17,21 c-5,0-9-2-12-6 v21 h-6 V42z M208,77 c7,0,12-5,12-15 s-5-15-12-15 c-7,0-12,5-12,15 s5,15,12,15z" />
        {/* l */}
        <Path d="M238,25 h6 v58 h-6 V25z" />
        {/* o */}
        <Path d="M256,62 c0-13,9-21,20-21 s20,8,20,21 s-9,21-20,21 s-20-8-20-21z M289,62 c0-9-5-15-13-15 s-13,6-13,15 s5,15,13,15 s13-6,13-15z" />
        {/* r */}
        <Path d="M308,42 h6 v7 c2-5,7-8,13-8 v7 h-2 c-7,0-11,4-11,12 v23 h-6 V42z" />
        {/* a */}
        <Path d="M334,62 c0-12,8-21,19-21 c12,0,19,8,19,20 v3 h-32 c1,8,6,13,14,13 c6,0,10-3,12-7 l5,3 c-3,6-9,10-17,10 c-12,0-20-8-20-21z M366,59 c-1-8-5-12-13-12 c-7,0-12,5-13,12 h26z" />
      </G>
    </Svg>
  );
};

export default EmploraIcon;
