import { motion } from 'framer-motion';

export default function QuestionCard({ question, onAnswer }) {
  const labels = question.responseOptions || ['Yes', 'No'];

  return (
    <motion.div
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.95, opacity: 0, x: -200 }}
      transition={{ duration: 0.3 }}
      className="bg-dark-50 rounded-3xl border border-dark-50 p-8 text-center"
    >
      <div className="mb-2 text-xs font-medium text-purple-glow uppercase tracking-wider">
        {question.category}
      </div>
      <h3 className="text-xl font-bold text-white mb-8 leading-relaxed">
        {question.questionText}
      </h3>

      <div className="flex justify-center gap-4">
        <button
          onClick={() => onAnswer(question.id, true)}
          className="px-8 py-3 rounded-xl bg-gold text-dark font-bold text-base
                     transition-transform active:scale-95"
        >
          {labels[0]}
        </button>
        <button
          onClick={() => onAnswer(question.id, false)}
          className="px-8 py-3 rounded-xl bg-dark-100 border border-gray-600 text-gray-300 font-bold text-base
                     transition-transform active:scale-95"
        >
          {labels[1]}
        </button>
      </div>
    </motion.div>
  );
}
