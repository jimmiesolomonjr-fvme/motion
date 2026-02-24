import { motion } from 'framer-motion';
import { Moon } from 'lucide-react';

export default function QuestionCard({ question, onAnswer }) {
  const labels = question.responseOptions || ['Yes', 'No'];
  const isAfterDark = question.category === 'AfterDark';

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0, y: 30 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      exit={{ scale: 0.7, opacity: 0, x: -300, rotate: -10 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className={
        isAfterDark
          ? 'bg-gradient-to-br from-purple-accent/30 via-dark-100 to-dark-300 rounded-3xl border border-purple-accent/40 shadow-purple p-8 text-center'
          : 'bg-dark-50 rounded-3xl border border-dark-50 p-8 text-center'
      }
    >
      <div className="mb-2 text-xs font-medium text-purple-glow uppercase tracking-wider">
        {isAfterDark ? (
          <span className="bg-purple-accent/20 rounded-full px-3 py-0.5 inline-flex items-center gap-1">
            <Moon size={12} />
            AfterDark
          </span>
        ) : (
          question.category
        )}
      </div>
      <h3 className="text-xl font-bold text-white mb-8 leading-relaxed">
        {question.questionText}
      </h3>

      <div className="flex justify-center gap-4">
        <motion.button
          whileTap={{ scale: 0.85 }}
          whileHover={{ scale: 1.05 }}
          onClick={() => onAnswer(question.id, true)}
          className={
            isAfterDark
              ? 'px-8 py-3 rounded-xl bg-purple-glow text-white font-bold text-base'
              : 'px-8 py-3 rounded-xl bg-gold text-dark font-bold text-base'
          }
        >
          {labels[0]}
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.85 }}
          whileHover={{ scale: 1.05 }}
          onClick={() => onAnswer(question.id, false)}
          className={
            isAfterDark
              ? 'px-8 py-3 rounded-xl bg-dark-300 border border-purple-accent/30 text-gray-300 font-bold text-base'
              : 'px-8 py-3 rounded-xl bg-dark-100 border border-gray-600 text-gray-300 font-bold text-base'
          }
        >
          {labels[1]}
        </motion.button>
      </div>
    </motion.div>
  );
}
