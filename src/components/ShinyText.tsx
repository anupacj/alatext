import React, { useState, useCallback } from 'react';
import { Platform, Text as RNText, StyleSheet } from 'react-native';
import './ShinyText.css';

export interface ShinyTextProps {
  text: string;
  disabled?: boolean;
  speed?: number;
  className?: string;
  color?: string;
  shineColor?: string;
  spread?: number;
  yoyo?: boolean;
  pauseOnHover?: boolean;
  direction?: 'left' | 'right';
  delay?: number;
  style?: any;
}

export const ShinyText: React.FC<ShinyTextProps> = ({
  text,
  disabled = false,
  speed = 2,
  className = '',
  color = '#b5b5b5',
  shineColor = '#ffffff',
  spread = 120,
  pauseOnHover = false,
  style = {},
}) => {
  const [isPaused, setIsPaused] = useState(false);

  const handleMouseEnter = useCallback(() => {
    if (pauseOnHover) setIsPaused(true);
  }, [pauseOnHover]);

  const handleMouseLeave = useCallback(() => {
    if (pauseOnHover) setIsPaused(false);
  }, [pauseOnHover]);

  const flatStyle = StyleSheet.flatten(style) || {};
  const { color: _ignoredColor, ...safeFlatStyle } = flatStyle;

  // Web typography fix: if lineHeight is a number > 3 (e.g. 20, 22), convert to px
  // so React DOM does not treat it as a 2200% multiplier (which made bubbles 350px tall!)
  if (typeof safeFlatStyle.lineHeight === 'number' && safeFlatStyle.lineHeight > 3) {
    safeFlatStyle.lineHeight = `${safeFlatStyle.lineHeight}px`;
  }

  // Cross-platform check: on mobile React Native native views, render animated RNText fallback
  if (Platform.OS !== 'web') {
    return (
      <RNText style={[{ color: shineColor || color }, flatStyle]}>
        {text}
      </RNText>
    );
  }

  const gradientStyle: React.CSSProperties = {
    backgroundImage: disabled
      ? 'none'
      : `linear-gradient(${spread}deg, ${color} 0%, ${color} 35%, ${shineColor} 50%, ${color} 65%, ${color} 100%)`,
    backgroundSize: '200% auto',
    WebkitBackgroundClip: 'text',
    backgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    color: 'transparent',
    display: 'inline-block',
    verticalAlign: 'baseline',
    maxWidth: '100%',
  };

  const isJosefin = typeof safeFlatStyle.fontFamily === 'string' && safeFlatStyle.fontFamily.toLowerCase().includes('josefin');
  const customFontFamily = isJosefin ? "'Josefin Sans', sans-serif" : safeFlatStyle.fontFamily;

  return (
    <span
      className={`shiny-text ${!disabled && !isPaused ? 'shiny-text-animated' : ''} ${isJosefin ? 'shiny-text-josefin' : ''} ${className}`}
      style={{
        ...safeFlatStyle,
        ...(customFontFamily ? { fontFamily: customFontFamily } : {}),
        ...gradientStyle,
        animationDuration: `${speed}s`,
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {text}
    </span>
  );
};

export default ShinyText;
