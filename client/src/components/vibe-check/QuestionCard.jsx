import { motion } from 'framer-motion';
import { ThumbsUp, ThumbsDown } from 'lucide-react';

export default function QuestionCard({ question, onAnswer }) {
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

      <div className="flex justify-center gap-6">
        <button
          onClick={() => onAnswer(question.id, false)}
          className="w-16 h-16 rounded-full bg-red-500/10 border-2 border-red-500/30
                     flex items-center justify-center hover:bg-red-500/20 hover:border-red-500
                     transition-all active:scale-90"
        >
          <ThumbsDown className="text-red-400" size={24} />
        </button>
        <button
          onClick={() => onAnswer(question.id, true)}
          className="w-16 h-16 rounded-full bg-green-500/10 border-2 border-green-500/30
                     flex items-center justify-center hover:bg-green-500/20 hover:border-green-500
                     transition-all active:scale-90"
        >
          <ThumbsUp className="text-green-400" size={24} />
        </button>
      </div>
    </motion.div>
  );
}
