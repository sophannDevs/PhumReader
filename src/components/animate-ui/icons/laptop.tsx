'use client';

import * as React from 'react';
import { motion, type Variants } from 'motion/react';

import {
  getVariants,
  useAnimateIconContext,
  IconWrapper,
  type IconProps,
} from '@animate-ui/react/icons';

// Path data copied verbatim from lucide-react (laptop), so the glyph matches the static icon.
type LaptopProps = IconProps<keyof typeof animations>;

const animations = {
  default: {
    group: {
      initial: { y: 0 },
      animate: {
        y: [0, -1.5, 0],
        transition: { duration: 0.5, ease: 'easeInOut' },
      },
    },
    line: {
      initial: { pathLength: 1 },
      animate: {
        pathLength: [0, 1],
        transition: { duration: 0.5, ease: 'easeInOut', delay: 0.15 },
      },
    },
  } satisfies Record<string, Variants>,
} as const;

function IconComponent({ size, ...props }: LaptopProps) {
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
        <path d="M18 5a2 2 0 0 1 2 2v8.526a2 2 0 0 0 .212.897l1.068 2.127a1 1 0 0 1-.9 1.45H3.62a1 1 0 0 1-.9-1.45l1.068-2.127A2 2 0 0 0 4 15.526V7a2 2 0 0 1 2-2z" />
        <motion.path
          d="M20.054 15.987H3.946"
          variants={variants.line}
          initial="initial"
          animate={controls}
        />
      </motion.g>
    </motion.svg>
  );
}

function Laptop(props: LaptopProps) {
  return <IconWrapper icon={IconComponent} size={24} {...props} />;
}

export {
  animations,
  Laptop,
  Laptop as LaptopIcon,
  type LaptopProps,
  type LaptopProps as LaptopIconProps,
};
