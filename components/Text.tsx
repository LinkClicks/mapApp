// components/Text.tsx
import React from 'react';
import { Text as RNText, TextProps } from 'react-native';

// Custom Text component that applies maxFontSizeMultiplier globally
const Text: React.FC<TextProps> = ({ children, style, ...props }) => {
  return (
    <RNText {...props} style={style} maxFontSizeMultiplier={1.0}>
      {children}
    </RNText>
  );
};

export default Text;
