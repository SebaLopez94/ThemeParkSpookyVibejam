import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, X } from 'lucide-react';

const GUIDE_LINES = [
  {
    tag: 'Gate Keeper',
    title: 'Welcome to Theme Spooky Park!',
    text: 'I keep the gates, count the screams, and pretend everything is perfectly safe. Ready to build a nightmare guests will actually pay for?'
  },
  {
    tag: 'Start here',
    title: 'First steps',
    text: 'Start simple: build a path, place your first ride next to it, and set a fair price. Too expensive, and your guests will run away before the screaming even begins.'
  },
  {
    tag: 'Keep guests alive-ish',
    title: 'Needs matter',
    text: 'Add Burger, Drink, and WC spots. Visitors have basic needs you can’t ignore. Decorations boost mood, but hungry guests are much harder to haunt.'
  },
  {
    tag: 'Grow smarter',
    title: 'Use your tools',
    text: 'These panels keep the park under control',
    bullets: [
      'Goals: claim rewards',
      'Lab: unlock new rides',
      'Park: adjust admission',
      'Feed: hear guest complaints'
    ]
  }
];

const guideVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      delay: 2,
      staggerChildren: 0.12,
      delayChildren: 0.05,
    },
  },
  exit: { opacity: 0, transition: { duration: 0.16 } },
};

const characterVariants = {
  hidden: { opacity: 0, y: 18, scale: 0.92 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring', stiffness: 260, damping: 22, mass: 0.8 },
  },
};

const bubbleVariants = {
  hidden: { opacity: 0, x: 14, y: 8, scale: 0.96 },
  visible: {
    opacity: 1,
    x: 0,
    y: 0,
    scale: 1,
    transition: { type: 'spring', stiffness: 250, damping: 24, mass: 0.9 },
  },
};

interface GuideCharacterProps {
  onClose: () => void;
}

export function GuideCharacter({ onClose }: GuideCharacterProps) {
  const [lineIndex, setLineIndex] = useState(0);
  const line = GUIDE_LINES[lineIndex];
  const isLast = lineIndex === GUIDE_LINES.length - 1;

  const handleNext = () => {
    if (isLast) {
      onClose();
      return;
    }
    setLineIndex(index => index + 1);
  };

  return (
    <motion.aside
      className="px-guide"
      variants={guideVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      aria-label="Park guide"
    >
      <motion.div
        className="px-guide__character"
        aria-hidden="true"
        variants={characterVariants}
      >
        <div className="px-guide__halo" />
        <img
          className="px-guide__gif"
          src="/ui/spooky-character-talking.gif"
          alt=""
          decoding="async"
        />
      </motion.div>

      <motion.div
        className="px-guide__bubble"
        variants={bubbleVariants}
      >
        <button className="px-guide__close" type="button" aria-label="Close guide" onClick={onClose}>
          <X size={14} />
        </button>
        <div className="px-guide__tag">{line.tag}</div>
        <h2 className="px-guide__title">{line.title}</h2>
        <AnimatePresence mode="wait">
          <motion.p
            key={lineIndex}
            className="px-guide__text"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.16 }}
          >
            {line.text}
          </motion.p>
        </AnimatePresence>
        {'bullets' in line && (
          <ul className="px-guide__bullets">
            {line.bullets.map(bullet => (
              <li key={bullet}>{bullet}</li>
            ))}
          </ul>
        )}
        <div className="px-guide__footer">
          <span className="px-guide__progress">{lineIndex + 1}/{GUIDE_LINES.length}</span>
          <button className="px-guide__next" type="button" onClick={handleNext}>
            {isLast ? 'Done' : 'Next'}
            <ChevronRight size={14} />
          </button>
        </div>
      </motion.div>
    </motion.aside>
  );
}
