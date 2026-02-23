import { LOOKING_FOR_TAGS } from '../../utils/constants';

export default function StepLookingFor({ profile, setProfile, onNext, onBack }) {
  const toggleTag = (tag) => {
    const tags = profile.lookingForTags || [];
    if (tags.includes(tag)) {
      setProfile({ ...profile, lookingForTags: tags.filter((t) => t !== tag) });
    } else {
      setProfile({ ...profile, lookingForTags: [...tags, tag] });
    }
  };

  const isValid = (profile.lookingForTags || []).length >= 1;

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">What Are You Looking For?</h2>
        <p className="text-gray-400">Select at least 1 tag that describes what you want</p>
      </div>

      <div>
        <input
          value={profile.lookingFor || ''}
          onChange={(e) => setProfile({ ...profile, lookingFor: e.target.value })}
          placeholder="Describe in your own words (optional)"
          className="w-full input-field py-2.5 text-sm"
          maxLength={100}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {LOOKING_FOR_TAGS.map((tag) => {
          const isActive = (profile.lookingForTags || []).includes(tag);
          return (
            <button
              key={tag}
              type="button"
              onClick={() => toggleTag(tag)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                isActive
                  ? 'bg-gold text-dark'
                  : 'bg-dark-100 text-gray-400 border border-dark-50 hover:border-gold/40 hover:text-white'
              }`}
            >
              {tag}
            </button>
          );
        })}
      </div>

      <div className="flex gap-3">
        <button onClick={onBack} className="btn-outline flex-1">Back</button>
        <button onClick={onNext} disabled={!isValid} className={`btn-gold flex-1 ${!isValid ? 'opacity-50 cursor-not-allowed' : ''}`}>
          Continue
        </button>
      </div>
    </div>
  );
}
