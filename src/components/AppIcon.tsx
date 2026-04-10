import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

type AppIconName =
  | 'dashboard'
  | 'clock'
  | 'time-off'
  | 'pay'
  | 'schedule'
  | 'profile'
  | 'employees'
  | 'add-employee'
  | 'payroll'
  | 'paystubs'
  | 'leave-requests'
  | 'plus'
  | 'seed'
  | 'edit-profile'
  | 'change-password'
  | 'help'
  | 'logout';

type AppIconProps = {
  name: AppIconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
};

export default function AppIcon({
  name,
  size = 24,
  color = '#3B82F6',
  strokeWidth = 2,
}: AppIconProps) {
  const commonStroke = {
    stroke: color,
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  switch (name) {
    case 'dashboard':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Rect x="4" y="4" width="6.5" height="6.5" rx="1.6" {...commonStroke} />
          <Rect x="13.5" y="4" width="6.5" height="6.5" rx="1.6" {...commonStroke} />
          <Rect x="4" y="13.5" width="6.5" height="6.5" rx="1.6" {...commonStroke} />
          <Rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.6" {...commonStroke} />
        </Svg>
      );

    case 'clock':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Circle cx="12" cy="12" r="8" {...commonStroke} />
          <Path d="M12 7.8V12l3.2 1.9" {...commonStroke} />
        </Svg>
      );

    case 'time-off':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Rect x="4" y="6" width="16" height="14" rx="3" {...commonStroke} />
          <Path d="M8 4.5V8" {...commonStroke} />
          <Path d="M16 4.5V8" {...commonStroke} />
          <Path d="M4 10.5H20" {...commonStroke} />
          <Path d="M9 14l2 2 4-4" {...commonStroke} />
        </Svg>
      );

    case 'pay':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Rect x="3.5" y="6.5" width="17" height="11" rx="3" {...commonStroke} />
          <Circle cx="12" cy="12" r="2.3" {...commonStroke} />
          <Path d="M7 10.5H7.01" {...commonStroke} />
          <Path d="M17 13.5H17.01" {...commonStroke} />
        </Svg>
      );

    case 'schedule':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Rect x="4" y="5.5" width="16" height="14" rx="2.8" {...commonStroke} />
          <Path d="M8 4.5V8" {...commonStroke} />
          <Path d="M16 4.5V8" {...commonStroke} />
          <Path d="M4 10.5H20" {...commonStroke} />
          <Path d="M8.5 14h2.5" {...commonStroke} />
          <Path d="M13 14h2.5" {...commonStroke} />
          <Path d="M8.5 17h7" {...commonStroke} />
        </Svg>
      );

    case 'profile':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Circle cx="12" cy="8.2" r="3.2" {...commonStroke} />
          <Path d="M6.5 18.3c1.4-2.6 3.5-3.9 5.5-3.9s4.1 1.3 5.5 3.9" {...commonStroke} />
        </Svg>
      );

    case 'employees':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Circle cx="9" cy="9" r="2.8" {...commonStroke} />
          <Circle cx="16.5" cy="10.5" r="2.2" {...commonStroke} />
          <Path d="M4.8 18.2c1.1-2.4 3-3.6 4.9-3.6 1.9 0 3.8 1.2 4.9 3.6" {...commonStroke} />
          <Path d="M14.2 17.4c.6-1.4 1.8-2.1 3-2.1 1.1 0 2.1.5 2.8 1.7" {...commonStroke} />
        </Svg>
      );

    case 'add-employee':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Circle cx="9" cy="8.5" r="3" {...commonStroke} />
          <Path d="M4.8 18c1-2.4 2.9-3.6 4.8-3.6 1.2 0 2.4.5 3.4 1.4" {...commonStroke} />
          <Path d="M17.5 8.5v6" {...commonStroke} />
          <Path d="M14.5 11.5h6" {...commonStroke} />
        </Svg>
      );

    case 'payroll':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Rect x="4" y="5" width="16" height="14" rx="2.5" {...commonStroke} />
          <Path d="M8 9.5h8" {...commonStroke} />
          <Path d="M8 13h4.5" {...commonStroke} />
          <Path d="M15.5 14.8c.7.5 1.7.5 2.4 0" {...commonStroke} />
        </Svg>
      );

    case 'paystubs':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M7 4.5h7l3 3V18a2 2 0 0 1-2 2H7A2 2 0 0 1 5 18V6.5a2 2 0 0 1 2-2z" {...commonStroke} />
          <Path d="M14 4.5v4h4" {...commonStroke} />
          <Path d="M8.5 12.2h7" {...commonStroke} />
          <Path d="M8.5 15.5h5" {...commonStroke} />
        </Svg>
      );

    case 'leave-requests':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Rect x="4" y="6" width="16" height="14" rx="3" {...commonStroke} />
          <Path d="M8 4.5V8" {...commonStroke} />
          <Path d="M16 4.5V8" {...commonStroke} />
          <Path d="M4 10.5H20" {...commonStroke} />
          <Path d="M9 14h6" {...commonStroke} />
        </Svg>
      );

    case 'plus':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M12 5v14" {...commonStroke} />
          <Path d="M5 12h14" {...commonStroke} />
        </Svg>
      );

    case 'seed':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M10 4.5c1.8 0 5.5 1.4 5.5 6 0 4.9-4 8.2-8 8.2-2 0-3-1.1-3-2.7C4.5 9.4 7.7 4.5 10 4.5z" {...commonStroke} />
          <Path d="M9 9c1.6 1.7 2.8 4.2 3.1 7.7" {...commonStroke} />
        </Svg>
      );

    case 'edit-profile':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Circle cx="9" cy="8" r="3" {...commonStroke} />
          <Path d="M4.5 18c.9-2.3 2.7-3.5 4.5-3.5 1 0 2 .4 2.8 1.1" {...commonStroke} />
          <Path d="M13.5 17.8l4.8-4.8 1.7 1.7-4.8 4.8-2.4.7z" {...commonStroke} />
        </Svg>
      );

    case 'change-password':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Rect x="5.5" y="10" width="13" height="9" rx="2.2" {...commonStroke} />
          <Path d="M8.5 10V8.5a3.5 3.5 0 0 1 7 0V10" {...commonStroke} />
          <Circle cx="12" cy="14.5" r="1.1" fill={color} />
        </Svg>
      );

    case 'help':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Circle cx="12" cy="12" r="8" {...commonStroke} />
          <Path d="M9.7 9.4a2.5 2.5 0 1 1 4.1 2c-.8.6-1.8 1.3-1.8 2.4" {...commonStroke} />
          <Path d="M12 17.1h.01" {...commonStroke} />
        </Svg>
      );

    case 'logout':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M10 6H7.5A2.5 2.5 0 0 0 5 8.5v7A2.5 2.5 0 0 0 7.5 18H10" {...commonStroke} />
          <Path d="M13 8l4 4-4 4" {...commonStroke} />
          <Path d="M9 12h8" {...commonStroke} />
        </Svg>
      );

    default:
      return null;
  }
}
