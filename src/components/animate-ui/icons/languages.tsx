'use client';

import * as React from 'react';
import { motion, type Variants } from 'motion/react';

import {
  getVariants,
  useAnimateIconContext,
  IconWrapper,
  type IconProps,
} from '@animate-ui/react/icons';

// Path data copied verbatim from lucide-react (languages), so the glyph matches the static icon.
type LanguagesProps = IconProps<keyof typeof animations>;

const animations = {
  default: {
    left: {
      initial: { rotate: 0 },
      animate: {
        rotate: [0, -10, 6, 0],
        transition: { duration: 0.6, ease: 'easeInOut' },
      },
    },
    right: {
      initial: { y: 0 },
      animate: {
        y: [0, -2, 0],
        transition: { duration: 0.5, ease: 'easeInOut', delay: 0.2 },
      },
    },
  } satisfies Record<string, Variants>,
} as const;

function IconComponent({ size, ...props }: LanguagesProps) {
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
      <motion.g variants={variants.left} initial="initial" animate={controls}>
        <path d="m5 8 6 6" />
        <path d="m4 14 6-6 2-3" />
        <path d="M2 5h12" />
        <path d="M7 2h1" />
      </motion.g>
      <motion.g variants={variants.right} initial="initial" animate={controls}>
        <path d="m22 22-5-10-5 10" />
        <path d="M14 18h6" />
      </motion.g>
    </motion.svg>
  );
}

function Languages(props: LanguagesProps) {
  return <IconWrapper icon={IconComponent} size={24} {...props} />;
}

export {
  animations,
  Languages,
  Languages as LanguagesIcon,
  type LanguagesProps,
  type LanguagesProps as LanguagesIconProps,
};
