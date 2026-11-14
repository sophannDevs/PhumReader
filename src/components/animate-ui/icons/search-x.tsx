'use client';

import * as React from 'react';
import { motion, type Variants } from 'motion/react';

import {
  getVariants,
  useAnimateIconContext,
  IconWrapper,
  type IconProps,
} from '@animate-ui/react/icons';

// Path data copied verbatim from lucide-react (search-x), so the glyph matches the static icon.
type SearchXProps = IconProps<keyof typeof animations>;

const animations = {
  default: {
    group: {
      initial: { rotate: 0 },
      animate: {
        rotate: [0, -10, 8, -4, 0],
        transformOrigin: 'bottom right',
        transition: { duration: 0.7, ease: 'easeInOut' },
      },
    },
    x1: {
      initial: { pathLength: 1 },
      animate: {
        pathLength: [0, 1],
        transition: { duration: 0.3, ease: 'easeInOut', delay: 0.2 },
      },
    },
    x2: {
      initial: { pathLength: 1 },
      animate: {
        pathLength: [0, 1],
        transition: { duration: 0.3, ease: 'easeInOut', delay: 0.4 },
      },
    },
  } satisfies Record<string, Variants>,
} as const;

function IconComponent({ size, ...props }: SearchXProps) {
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
          d="m13.5 8.5-5 5"
          variants={variants.x1}
          initial="initial"
          animate={controls}
        />
        <motion.path
          d="m8.5 8.5 5 5"
          variants={variants.x2}
          initial="initial"
          animate={controls}
        />
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.3-4.3" />
      </motion.g>
    </motion.svg>
  );
}

function SearchX(props: SearchXProps) {
  return <IconWrapper icon={IconComponent} size={24} {...props} />;
}

export {
  animations,
  SearchX,
  SearchX as SearchXIcon,
  type SearchXProps,
  type SearchXProps as SearchXIconProps,
};
