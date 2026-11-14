'use client';

import * as React from 'react';
import { motion, type Variants } from 'motion/react';

import {
  getVariants,
  useAnimateIconContext,
  IconWrapper,
  type IconProps,
} from '@animate-ui/react/icons';

// Path data copied verbatim from lucide-react (coins), so the glyph matches the static icon.
type CoinsProps = IconProps<keyof typeof animations>;

const animations = {
  default: {
    group: {
      initial: { rotate: 0 },
      animate: {
        rotate: [0, -12, 10, -6, 0],
        transition: { duration: 0.7, ease: 'easeInOut' },
      },
    },
    front: {
      initial: { y: 0 },
      animate: {
        y: [0, -2, 0],
        transition: { duration: 0.5, ease: 'easeInOut' },
      },
    },
  } satisfies Record<string, Variants>,
} as const;

function IconComponent({ size, ...props }: CoinsProps) {
  const { controls } = useAnimateIconContext();
  const variants = getVariants(animations);

  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <motion.g variants={variants.group} initial="initial" animate={controls}>
        <path d="M13.744 17.736a6 6 0 1 1-7.48-7.48" />
        <path d="m6.134 14.768.866-.5 2 3.464" />
        <motion.g variants={variants.front} initial="initial" animate={controls}>
          <path d="M15 6h1v4" />
          <circle cx="16" cy="8" r="6" />
        </motion.g>
      </motion.g>
    </motion.svg>
  );
}

function Coins(props: CoinsProps) {
  return <IconWrapper icon={IconComponent} size={24} {...props} />;
}

export {
  animations,
  Coins,
  Coins as CoinsIcon,
  type CoinsProps,
  type CoinsProps as CoinsIconProps,
};
