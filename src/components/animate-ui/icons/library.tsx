'use client';

import * as React from 'react';
import { motion, type Variants } from 'motion/react';

import {
  getVariants,
  useAnimateIconContext,
  IconWrapper,
  type IconProps,
} from '@animate-ui/react/icons';

// Path data copied verbatim from lucide-react (library), so the glyph matches the static icon.
type LibraryProps = IconProps<keyof typeof animations>;

const animations = {
  default: {
    tilted: {
      initial: { rotate: 0 },
      animate: {
        rotate: [0, 10, -4, 0],
        transformOrigin: 'bottom left',
        transition: { duration: 0.7, ease: 'easeInOut' },
      },
    },
    book1: {
      initial: { y: 0 },
      animate: {
        y: [0, -2, 0],
        transition: { duration: 0.4, ease: 'easeInOut' },
      },
    },
    book2: {
      initial: { y: 0 },
      animate: {
        y: [0, -2, 0],
        transition: { duration: 0.4, ease: 'easeInOut', delay: 0.1 },
      },
    },
    book3: {
      initial: { y: 0 },
      animate: {
        y: [0, -2, 0],
        transition: { duration: 0.4, ease: 'easeInOut', delay: 0.2 },
      },
    },
  } satisfies Record<string, Variants>,
} as const;

function IconComponent({ size, ...props }: LibraryProps) {
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
      <motion.path
        d="m16 6 4 14"
        variants={variants.tilted}
        initial="initial"
        animate={controls}
      />
      <motion.path
        d="M12 6v14"
        variants={variants.book3}
        initial="initial"
        animate={controls}
      />
      <motion.path
        d="M8 8v12"
        variants={variants.book2}
        initial="initial"
        animate={controls}
      />
      <motion.path
        d="M4 4v16"
        variants={variants.book1}
        initial="initial"
        animate={controls}
      />
    </motion.svg>
  );
}

function Library(props: LibraryProps) {
  return <IconWrapper icon={IconComponent} size={24} {...props} />;
}

export {
  animations,
  Library,
  Library as LibraryIcon,
  type LibraryProps,
  type LibraryProps as LibraryIconProps,
};
