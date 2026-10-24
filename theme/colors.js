export const light = {
  maroon: '#7a1417',
  maroonDark: '#5c0f11',
  maroonLight: '#f6e6e7',
  pink: '#fbe9ea',
  white: '#ffffff',
  surface: '#ffffff',
  bg: '#f5f5f5',
  text: '#1f1f1f',
  textMuted: '#6b6b6b',
  border: '#e5e5e5',
  success: '#1f8a3b',
  successBg: '#e6f6ea',
  warning: '#b8860b',
  warningBg: '#fdf3d9',
  danger: '#c0392b',
  dangerBg: '#fbe9e7',
  info: '#2a6fb0',
  infoBg: '#e8f1fb',
};

export const dark = {
  maroon: '#a3262a',
  maroonDark: '#7a1417',
  maroonLight: '#3a1a1c',
  pink: '#2e1a1b',
  white: '#f2f2f2',
  surface: '#222222',
  bg: '#141414',
  text: '#ececec',
  textMuted: '#a0a0a0',
  border: '#343434',
  success: '#5fd684',
  successBg: '#173322',
  warning: '#e0b344',
  warningBg: '#3a2f16',
  danger: '#f08177',
  dangerBg: '#3a201d',
  info: '#7bb3e8',
  infoBg: '#1c2c3d',
};

// Default export kept for the login screen's fixed brand background, which
// doesn't follow the light/dark toggle (same reasoning as most apps' auth
// screens: it's a maroon photo overlay, not a themed surface).
export default light;
