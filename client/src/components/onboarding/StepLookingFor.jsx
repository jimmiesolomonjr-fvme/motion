import { LOOKING_FOR_TAGS, MAX_LOOKING_FOR_TAGS } from '../../utils/constants';

export default function StepLookingFor({ profile, setProfile, onNext, onBack }) {
  const tags = profile.lookingForTags || [];
  const atCapacity = tags.length >= MAX_LOOKING_FOR_TAGS;

  const toggleTag = (tag) => {
    if (tags.includes(tag)) {
      setProfile({ ...profile, lookingForTags: tags.filter((t) => t !== tag) });
    } else if (!atCapacity) {
      setProfile({ ...profile, lookingForTags: [...tags, tag] });
    }
  };

  const hasText = (profile.lookingFor || '').trim().length > 0;
  const hasTags = tags.length >= 1;
  const isValid = hasText && hasTags;

  return (
    <div className="space-y-6">
      {/* Section 1: Text input (required) */}
      <div>
        <div className="text-center mb-4">
          <h2 className="text-2xl font-bold mb-2">What Are You Looking For?</h2>
          <p className="text-gray-400">Describe what you want in your own words</p>
        </div>
        <input
          value={profile.lookingFor || ''}
          onChange={(e) => setProfile({ ...profile, lookingFor: e.target.value })}
          placeholder="e.g. Someone who loves adventure and good conversation"
          className="w-full input-field py-2.5 text-sm"
          maxLength={100}
        />
        {!hasText && (
          <p className="text-xs text-gray-500 mt-1.5">Required — tell people what you're looking for</p>
        )}
      </div>

      <div className="border-t border-dark-50" />

      {/* Section 2: Tags */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-white">Select Your Tags</h3>
          <span className={`text-sm font-medium ${atCapacity ? 'text-gold' : 'text-gray-400'}`}>
            {tags.length}/{MAX_LOOKING_FOR_TAGS} selected
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {LOOKING_FOR_TAGS.map((tag) => {
            const isActive = tags.includes(tag);
            const isDisabled = !isActive && atCapacity;
            return (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                disabled={isDisabled}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-gold text-dark'
                    : isDisabled
                      ? 'bg-dark-100 text-gray-600 border border-dark-50 opacity-50 cursor-not-allowed'
                      : 'bg-dark-100 text-gray-400 border border-dark-50 hover:border-gold/40 hover:text-white'
                }`}
              >
                {tag}
              </button>
            );
          })}
        </div>
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
