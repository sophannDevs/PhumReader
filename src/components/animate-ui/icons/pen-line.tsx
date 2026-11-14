'use client';

import * as React from 'react';
import { motion, type Variants } from 'motion/react';

import {
  getVariants,
  useAnimateIconContext,
  IconWrapper,
  type IconProps,
} from '@animate-ui/react/icons';

// Path data copied verbatim from lucide-react (pen-line), so the glyph matches the static icon.
type PenLineProps = IconProps<keyof typeof animations>;

const animations = {
  default: {
    pen: {
      initial: { rotate: 0, x: 0, y: 0 },
      animate: {
        rotate: [0, -8, 6, -3, 0],
        x: [0, 1, -1, 0],
        y: [0, -1, 1, 0],
        transformOrigin: 'bottom left',
        transition: { duration: 0.7, ease: 'easeInOut' },
      },
    },
    line: {
      initial: { pathLength: 1 },
      animate: {
        pathLength: [0, 1],
        transition: { duration: 0.5, ease: 'easeInOut', delay: 0.2 },
      },
    },
  } satisfies Record<string, Variants>,
} as const;

function IconComponent({ size, ...props }: PenLineProps) {
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
        d="M13 21h8"
        variants={variants.line}
        initial="initial"
        animate={controls}
      />
      <motion.path
        d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"
        variants={variants.pen}
        initial="initial"
        animate={controls}
      />
    </motion.svg>
  );
}

function PenLine(props: PenLineProps) {
  return <IconWrapper icon={IconComponent} size={24} {...props} />;
}

export {
  animations,
  PenLine,
  PenLine as PenLineIcon,
  type PenLineProps,
  type PenLineProps as PenLineIconProps,
};
