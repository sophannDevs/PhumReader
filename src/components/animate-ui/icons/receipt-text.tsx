'use client';

import * as React from 'react';
import { motion, type Variants } from 'motion/react';

import {
  getVariants,
  useAnimateIconContext,
  IconWrapper,
  type IconProps,
} from '@animate-ui/react/icons';

// Path data copied verbatim from lucide-react (receipt-text), so the glyph matches the static icon.
type ReceiptTextProps = IconProps<keyof typeof animations>;

const animations = {
  default: {
    group: {
      initial: { y: 0 },
      animate: {
        y: [0, -1.5, 0],
        transition: { duration: 0.6, ease: 'easeInOut' },
      },
    },
    line1: {
      initial: { pathLength: 1 },
      animate: {
        pathLength: [0, 1],
        transition: { duration: 0.3, ease: 'easeInOut' },
      },
    },
    line2: {
      initial: { pathLength: 1 },
      animate: {
        pathLength: [0, 1],
        transition: { duration: 0.3, ease: 'easeInOut', delay: 0.15 },
      },
    },
    line3: {
      initial: { pathLength: 1 },
      animate: {
        pathLength: [0, 1],
        transition: { duration: 0.3, ease: 'easeInOut', delay: 0.3 },
      },
    },
  } satisfies Record<string, Variants>,
} as const;

function IconComponent({ size, ...props }: ReceiptTextProps) {
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
        <motion.path
          d="M13 16H8"
          variants={variants.line3}
          initial="initial"
          animate={controls}
        />
        <motion.path
          d="M14 8H8"
          variants={variants.line1}
          initial="initial"
          animate={controls}
        />
        <motion.path
          d="M16 12H8"
          variants={variants.line2}
          initial="initial"
          animate={controls}
        />
        <path d="M4 3a1 1 0 0 1 1-1 1.3 1.3 0 0 1 .7.2l.933.6a1.3 1.3 0 0 0 1.4 0l.934-.6a1.3 1.3 0 0 1 1.4 0l.933.6a1.3 1.3 0 0 0 1.4 0l.933-.6a1.3 1.3 0 0 1 1.4 0l.934.6a1.3 1.3 0 0 0 1.4 0l.933-.6A1.3 1.3 0 0 1 19 2a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1 1.3 1.3 0 0 1-.7-.2l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.934.6a1.3 1.3 0 0 1-1.4 0l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-1.4 0l-.934-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-.7.2 1 1 0 0 1-1-1z" />
      </motion.g>
    </motion.svg>
  );
}

function ReceiptText(props: ReceiptTextProps) {
  return <IconWrapper icon={IconComponent} size={24} {...props} />;
}

export {
  animations,
  ReceiptText,
  ReceiptText as ReceiptTextIcon,
  type ReceiptTextProps,
  type ReceiptTextProps as ReceiptTextIconProps,
};
